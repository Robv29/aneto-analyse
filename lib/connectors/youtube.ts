import { ConnectorError } from './types'
import type { NormalizedContentItem } from './types'
import { normalizeYouTubeVideo, plainTextFromVtt } from '@/src/connectors/youtube.mjs'
import { timedSegmentsFromVtt } from '@/src/clips.mjs'

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_ANALYTICS_API_URL = 'https://youtubeanalytics.googleapis.com/v2/reports'

const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

export const YOUTUBE_CAPTIONS_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

export type YouTubeTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scope: string
  tokenType: string
}

type YouTubeChannelResponse = {
  items?: Array<{
    id?: string
    snippet?: { title?: string }
    contentDetails?: { relatedPlaylists?: { uploads?: string } }
  }>
  error?: { message?: string }
}

type YouTubePlaylistResponse = {
  nextPageToken?: string
  items?: Array<{ contentDetails?: { videoId?: string } }>
  error?: { message?: string }
}

type YouTubeVideosResponse = {
  items?: unknown[]
  error?: { message?: string }
}

type YouTubeCaptionsResponse = {
  items?: Array<{
    id?: string
    snippet?: {
      language?: string
      name?: string
      trackKind?: string
      isDraft?: boolean
      isAutoSynced?: boolean
      status?: string
      lastUpdated?: string
    }
  }>
  error?: { message?: string }
}

type YouTubeAnalyticsResponse = {
  rows?: Array<[number, number, number]>
  error?: { message?: string }
}

export type YouTubeTranscript = {
  status: 'available' | 'unavailable'
  text: string | null
  language: string | null
  trackKind: string | null
  captionTrackId: string | null
  lastUpdated: string | null
  segments: Array<{ start: number; end: number; text: string }>
}

export type YouTubeRetentionPoint = {
  elapsedRatio: number
  audienceWatchRatio: number
  relativeRetentionPerformance: number
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

export async function refreshYouTubeTokens(tokens: YouTubeTokens): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getOAuthCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json() as {
    access_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
    error_description?: string
  }
  if (!response.ok || !payload.access_token) {
    throw new ConnectorError(payload.error_description ?? 'Google a refusé le renouvellement YouTube.', 'unauthorized')
  }
  return {
    ...tokens,
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope ?? tokens.scope,
    tokenType: payload.token_type ?? tokens.tokenType,
  }
}

export class YouTubeClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken) throw new ConnectorError('Jeton YouTube manquant.', 'missing_token')
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${YOUTUBE_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const payload = await response.json() as T & { error?: { message?: string } }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ConnectorError(payload.error?.message ?? 'Autorisation YouTube refusée.', 'unauthorized')
      }
      if (response.status === 429) throw new ConnectorError('Quota YouTube atteint.', 'rate_limited', 3600)
      throw new ConnectorError(payload.error?.message ?? `YouTube a répondu avec le statut ${response.status}.`, 'upstream_error')
    }
    return payload
  }

  private async requestText(path: string): Promise<string> {
    const response = await fetch(`${YOUTUBE_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'text/vtt' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ConnectorError('Google n’autorise pas encore la lecture des sous-titres.', 'captions_unauthorized')
      }
      if (response.status === 429) throw new ConnectorError('Quota YouTube atteint.', 'rate_limited', 3600)
      throw new ConnectorError(`YouTube a répondu avec le statut ${response.status}.`, 'upstream_error')
    }
    return response.text()
  }

  async listVideos(channelId: string): Promise<NormalizedContentItem[]> {
    const channel = await this.request<YouTubeChannelResponse>('/channels?part=id,snippet,contentDetails&mine=true')
    const current = channel.items?.find((item) => item.id === channelId) ?? channel.items?.[0]
    const uploadsId = current?.contentDetails?.relatedPlaylists?.uploads
    if (!current?.id || !uploadsId) throw new ConnectorError('La playlist des vidéos YouTube est introuvable.', 'channel_unavailable')
    if (current.id !== channelId) throw new ConnectorError('La chaîne autorisée ne correspond plus à la source Aneto.', 'channel_mismatch')

    const ids: string[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({ part: 'contentDetails', playlistId: uploadsId, maxResults: '50' })
      if (pageToken) params.set('pageToken', pageToken)
      const page = await this.request<YouTubePlaylistResponse>(`/playlistItems?${params}`)
      for (const item of page.items ?? []) {
        if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId)
      }
      pageToken = page.nextPageToken
    } while (pageToken && ids.length < 500)

    const observedAt = new Date().toISOString()
    const items: NormalizedContentItem[] = []
    for (let offset = 0; offset < ids.length; offset += 50) {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,statistics',
        id: ids.slice(offset, offset + 50).join(','),
      })
      const page = await this.request<YouTubeVideosResponse>(`/videos?${params}`)
      for (const video of page.items ?? []) items.push(normalizeYouTubeVideo(video, observedAt) as NormalizedContentItem)
    }
    return items
  }

  async getAudienceRetention(videoId: string): Promise<YouTubeRetentionPoint[]> {
    const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: '2008-01-01',
      endDate,
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
      dimensions: 'elapsedVideoTimeRatio',
      filters: `video==${videoId}`,
      maxResults: '200',
    })
    const response = await fetch(`${YOUTUBE_ANALYTICS_API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const payload = await response.json() as YouTubeAnalyticsResponse
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new ConnectorError(payload.error?.message ?? 'Les données de rétention YouTube ne sont pas accessibles.', 'unauthorized')
      if (response.status === 429) throw new ConnectorError('Quota YouTube Analytics atteint.', 'rate_limited', 3600)
      throw new ConnectorError(payload.error?.message ?? `YouTube Analytics a répondu avec le statut ${response.status}.`, 'upstream_error')
    }
    return (payload.rows ?? []).map(([elapsedRatio, audienceWatchRatio, relativeRetentionPerformance]) => ({
      elapsedRatio: Number(elapsedRatio),
      audienceWatchRatio: Number(audienceWatchRatio),
      relativeRetentionPerformance: Number(relativeRetentionPerformance),
    })).filter((point) => Object.values(point).every(Number.isFinite))
  }

  async getTranscript(videoId: string): Promise<YouTubeTranscript> {
    const params = new URLSearchParams({ part: 'id,snippet', videoId })
    const captions = await this.request<YouTubeCaptionsResponse>(`/captions?${params}`)
    const tracks = (captions.items ?? []).filter((track) => track.id && track.snippet?.status !== 'failed')
    if (!tracks.length) {
      return { status: 'unavailable', text: null, language: null, trackKind: null, captionTrackId: null, lastUpdated: null, segments: [] }
    }

    const score = (track: (typeof tracks)[number]) => {
      const language = track.snippet?.language?.toLowerCase() ?? ''
      return (language === 'fr' || language.startsWith('fr-') ? 100 : 0)
        + (track.snippet?.trackKind === 'standard' ? 20 : 0)
        + (track.snippet?.isDraft ? 0 : 5)
    }
    const track = [...tracks].sort((a, b) => score(b) - score(a))[0]
    const vtt = await this.requestText(`/captions/${encodeURIComponent(track.id!)}?tfmt=vtt`)
    const text = plainTextFromVtt(vtt)
    const segments = timedSegmentsFromVtt(vtt)
    if (!text) {
      return { status: 'unavailable', text: null, language: track.snippet?.language ?? null, trackKind: track.snippet?.trackKind ?? null, captionTrackId: track.id ?? null, lastUpdated: track.snippet?.lastUpdated ?? null, segments: [] }
    }
    return {
      status: 'available',
      text,
      language: track.snippet?.language ?? null,
      trackKind: track.snippet?.trackKind ?? null,
      captionTrackId: track.id ?? null,
      lastUpdated: track.snippet?.lastUpdated ?? null,
      segments,
    }
  }
}
