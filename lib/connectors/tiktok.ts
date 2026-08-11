import { normalizeTikTokVideo } from '@/src/connectors/tiktok.mjs'
import { ConnectorError } from './types'
import type { NormalizedContentItem } from './types'

const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_API_URL = 'https://open.tiktokapis.com/v2'
const TIKTOK_SCOPES = ['user.info.basic', 'video.list']

export type TikTokTokens = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
  openId: string
  scope: string
  tokenType: string
}

type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  open_id?: string
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type TikTokError = { code?: string; message?: string; log_id?: string }

function getOAuthCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_ID
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) throw new ConnectorError('TikTok n’est pas configuré sur Vercel.', 'missing_credentials')
  return { clientKey, clientSecret }
}

export function getTikTokRedirectUri() {
  const appUrl = process.env.ANETO_APP_URL?.replace(/\/$/, '') ?? 'https://aneto-analyse.vercel.app'
  return `${appUrl}/api/oauth/tiktok/callback`
}

export function createTikTokAuthorizationUrl(state: string) {
  const { clientKey } = getOAuthCredentials()
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_SCOPES.join(','),
    response_type: 'code',
    redirect_uri: getTikTokRedirectUri(),
    state,
  })
  return `${TIKTOK_AUTHORIZE_URL}?${params}`
}

function normalizeTokens(payload: TikTokTokenResponse, previous?: TikTokTokens): TikTokTokens {
  if (!payload.access_token || !payload.refresh_token || !payload.open_id) {
    throw new ConnectorError(payload.error_description ?? 'TikTok a refusé la connexion.', 'oauth_exchange_failed')
  }
  const now = Date.now()
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessTokenExpiresAt: new Date(now + Number(payload.expires_in ?? 86_400) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(now + Number(payload.refresh_expires_in ?? 31_536_000) * 1000).toISOString(),
    openId: payload.open_id,
    scope: payload.scope ?? previous?.scope ?? TIKTOK_SCOPES.join(','),
    tokenType: payload.token_type ?? previous?.tokenType ?? 'Bearer',
  }
}

async function tokenRequest(body: URLSearchParams, previous?: TikTokTokens) {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json() as TikTokTokenResponse
  if (!response.ok) {
    throw new ConnectorError(payload.error_description ?? 'TikTok a refusé l’autorisation.', response.status === 401 ? 'unauthorized' : 'oauth_exchange_failed')
  }
  return normalizeTokens(payload, previous)
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getOAuthCredentials()
  return tokenRequest(new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: getTikTokRedirectUri(),
  }))
}

export async function refreshTikTokTokens(tokens: TikTokTokens): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getOAuthCredentials()
  return tokenRequest(new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  }), tokens)
}

export class TikTokClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken) throw new ConnectorError('Jeton TikTok manquant.', 'missing_token')
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${TIKTOK_API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const payload = await response.json() as T & { error?: TikTokError }
    const errorCode = payload.error?.code
    if (!response.ok || (errorCode && errorCode !== 'ok')) {
      if (response.status === 401 || response.status === 403 || errorCode === 'access_token_invalid') {
        throw new ConnectorError(payload.error?.message ?? 'Autorisation TikTok refusée.', 'unauthorized')
      }
      if (response.status === 429) throw new ConnectorError('Quota TikTok atteint.', 'rate_limited', 3600)
      throw new ConnectorError(payload.error?.message ?? `TikTok a répondu avec le statut ${response.status}.`, 'upstream_error')
    }
    return payload
  }

  async getUser() {
    const fields = 'open_id,union_id,avatar_url,display_name,profile_deep_link,bio_description'
    const payload = await this.request<{
      data?: { user?: { open_id?: string; display_name?: string; profile_deep_link?: string } }
    }>(`/user/info/?fields=${fields}`)
    const user = payload.data?.user
    if (!user?.open_id) throw new ConnectorError('Le compte TikTok autorisé est introuvable.', 'account_unavailable')
    return {
      id: user.open_id,
      displayName: user.display_name?.trim() || 'Compte TikTok',
      profileUrl: user.profile_deep_link ?? null,
    }
  }

  async listVideos(maxCount = 4): Promise<NormalizedContentItem[]> {
    const fields = 'id,create_time,cover_image_url,share_url,video_description,duration,title,like_count,comment_count,share_count,view_count'
    const payload = await this.request<{ data?: { videos?: unknown[] } }>(`/video/list/?fields=${fields}`, {
      method: 'POST',
      body: JSON.stringify({ max_count: Math.max(1, Math.min(20, maxCount)) }),
    })
    const observedAt = new Date().toISOString()
    return (payload.data?.videos ?? []).slice(0, maxCount).map((video) => normalizeTikTokVideo(video, observedAt) as NormalizedContentItem)
  }
}
