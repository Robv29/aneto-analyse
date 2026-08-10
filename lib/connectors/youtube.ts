import { ConnectorError } from './types'

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

export type YouTubeTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
  tokenType: string
}

export function getYouTubeRedirectUri() {
  const appUrl = process.env.ANETO_APP_URL?.replace(/\/$/, '') ?? 'https://aneto-analyse.vercel.app'
  return `${appUrl}/api/oauth/youtube/callback`
}

function getOAuthCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new ConnectorError('YouTube n’est pas configuré sur Vercel.', 'missing_credentials')
  return { clientId, clientSecret }
}

export function createYouTubeAuthorizationUrl(state: string) {
  const { clientId } = getOAuthCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getYouTubeRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    scope: scopes.join(' '),
  })
  return `${GOOGLE_OAUTH_URL}?${params}`
}

export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getOAuthCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getYouTubeRedirectUri(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
    error_description?: string
  }
  if (!response.ok || !payload.access_token) {
    throw new ConnectorError(payload.error_description ?? 'Google a refusé la connexion.', 'oauth_exchange_failed')
  }
  if (!payload.refresh_token) {
    throw new ConnectorError('Google n’a pas fourni d’autorisation durable. Relance la connexion.', 'missing_refresh_token')
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope ?? scopes.join(' '),
    tokenType: payload.token_type ?? 'Bearer',
  }
}

export async function getAuthorizedYouTubeChannel(accessToken: string) {
  const response = await fetch(`${YOUTUBE_API_URL}/channels?part=id,snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json() as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>
    error?: { message?: string }
  }
  const channel = payload.items?.[0]
  if (!response.ok || !channel?.id) {
    throw new ConnectorError(payload.error?.message ?? 'Aucune chaîne YouTube accessible avec ce compte.', 'channel_unavailable')
  }
  return { id: channel.id, title: channel.snippet?.title ?? 'Chaîne YouTube' }
}
