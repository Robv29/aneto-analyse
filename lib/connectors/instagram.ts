import { ConnectorError } from './types'
import type { NormalizedContentItem } from './types'
import { normalizeInstagramMedia } from '@/src/connectors/instagram.mjs'

// Instagram passe par Facebook Login : le compte Instagram professionnel doit
// être relié à une Page Facebook, et c'est cette Page qui donne accès au
// compte Instagram Business via la Graph API.
const FACEBOOK_OAUTH_URL = 'https://www.facebook.com/v21.0/dialog/oauth'
const GRAPH_URL = 'https://graph.facebook.com/v21.0'

const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
]

export type InstagramTokens = {
  accessToken: string
  expiresAt: string
  accountId: string
  username: string
}

type GraphError = { message?: string; code?: number; type?: string }

function getOAuthCredentials() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new ConnectorError('Instagram n’est pas configuré sur Vercel.', 'missing_credentials')
  return { clientId, clientSecret }
}

export function getInstagramRedirectUri() {
  const appUrl = process.env.ANETO_APP_URL?.replace(/\/$/, '') ?? 'https://aneto-analyse.vercel.app'
  return `${appUrl}/api/oauth/instagram/callback`
}

export function createInstagramAuthorizationUrl(state: string) {
  const { clientId } = getOAuthCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: 'code',
    state,
    scope: SCOPES.join(','),
  })
  return `${FACEBOOK_OAUTH_URL}?${params}`
}

async function graphRequest<T>(path: string, accessToken: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`${GRAPH_URL}${path}${separator}access_token=${encodeURIComponent(accessToken)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json() as T & { error?: GraphError }
  if (!response.ok || payload.error) {
    const message = payload.error?.message ?? `Instagram a répondu avec le statut ${response.status}.`
    if (response.status === 401 || payload.error?.code === 190) throw new ConnectorError(message, 'unauthorized')
    if (response.status === 429 || payload.error?.code === 4 || payload.error?.code === 17) {
      throw new ConnectorError('Quota Instagram atteint.', 'rate_limited', 3600)
    }
    throw new ConnectorError(message, 'upstream_error')
  }
  return payload
}

/**
 * Échange le code contre un jeton longue durée (60 jours), puis résout le
 * compte Instagram professionnel rattaché à la première Page autorisée.
 */
export async function exchangeInstagramCode(code: string): Promise<InstagramTokens> {
  const { clientId, clientSecret } = getOAuthCredentials()

  const shortLived = await graphRequestRaw<{ access_token?: string; error?: GraphError }>(
    `/oauth/access_token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(getInstagramRedirectUri())}&code=${encodeURIComponent(code)}`,
  )
  if (!shortLived.access_token) {
    throw new ConnectorError(shortLived.error?.message ?? 'Facebook a refusé la connexion.', 'oauth_exchange_failed')
  }

  const longLived = await graphRequestRaw<{ access_token?: string; expires_in?: number; error?: GraphError }>(
    `/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(shortLived.access_token)}`,
  )
  const accessToken = longLived.access_token ?? shortLived.access_token
  const expiresAt = new Date(Date.now() + Number(longLived.expires_in ?? 60 * 24 * 3600) * 1000).toISOString()

  const account = await getInstagramAccount(accessToken)
  return { accessToken, expiresAt, accountId: account.id, username: account.username }
}

async function graphRequestRaw<T>(path: string): Promise<T> {
  const response = await fetch(`${GRAPH_URL}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  return await response.json() as T
}

export async function getInstagramAccount(accessToken: string) {
  const pages = await graphRequest<{
    data?: Array<{ id?: string; name?: string; instagram_business_account?: { id?: string; username?: string } }>
  }>('/me/accounts?fields=id,name,instagram_business_account{id,username}', accessToken)

  const linked = (pages.data ?? []).find((page) => page.instagram_business_account?.id)
  if (!linked?.instagram_business_account?.id) {
    throw new ConnectorError(
      'Aucun compte Instagram professionnel n’est relié à tes Pages Facebook. Passe ton compte en Professionnel et relie-le à une Page, puis recommence.',
      'account_unavailable',
    )
  }
  return {
    id: linked.instagram_business_account.id,
    username: linked.instagram_business_account.username ?? 'Compte Instagram',
  }
}

export class InstagramClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken) throw new ConnectorError('Jeton Instagram manquant.', 'missing_token')
  }

  async listMedia(accountId: string, maxCount = 60): Promise<NormalizedContentItem[]> {
    const fields = [
      'id', 'caption', 'media_type', 'media_product_type', 'permalink',
      'thumbnail_url', 'media_url', 'timestamp', 'like_count', 'comments_count',
    ].join(',')

    const observedAt = new Date().toISOString()
    const items: NormalizedContentItem[] = []
    let path = `/${encodeURIComponent(accountId)}/media?fields=${fields}&limit=50`

    while (path && items.length < maxCount) {
      const page = await graphRequest<{
        data?: Array<Record<string, unknown>>
        paging?: { next?: string; cursors?: { after?: string } }
      }>(path, this.accessToken)

      for (const media of page.data ?? []) {
        if (items.length >= maxCount) break
        const insights = await this.getMediaInsights(String(media.id), String(media.media_product_type ?? ''))
        items.push(normalizeInstagramMedia({ ...media, insights }, observedAt) as NormalizedContentItem)
      }

      const after = page.paging?.cursors?.after
      path = after && items.length < maxCount
        ? `/${encodeURIComponent(accountId)}/media?fields=${fields}&limit=50&after=${encodeURIComponent(after)}`
        : ''
    }
    return items
  }

  /**
   * Les métriques de portée ne sont pas exposées sur le média lui-même.
   * Un échec ici ne doit pas faire tomber la synchronisation : le contenu
   * est alors importé avec ses seuls likes et commentaires.
   */
  private async getMediaInsights(mediaId: string, productType: string) {
    const metrics = productType.toUpperCase() === 'REELS'
      ? 'views,reach,likes,comments,saved,shares'
      : 'reach,saved'
    try {
      const payload = await graphRequest<{ data?: Array<{ name?: string; values?: Array<{ value?: number }> }> }>(
        `/${encodeURIComponent(mediaId)}/insights?metric=${metrics}`,
        this.accessToken,
      )
      return Object.fromEntries((payload.data ?? []).flatMap((entry) => {
        const value = entry.values?.[0]?.value
        return entry.name && Number.isFinite(value) ? [[entry.name, value as number]] : []
      }))
    } catch {
      return {}
    }
  }
}
