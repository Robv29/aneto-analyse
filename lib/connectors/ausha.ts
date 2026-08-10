import { ConnectorError, type NormalizedContentItem } from './types'
import { normalizeAushaPodcast } from '@/src/connectors/ausha.mjs'

const AUSHA_API = 'https://developers.ausha.co/v1'

type AushaCollection = {
  data?: unknown[]
  meta?: { pagination?: { current_page?: number; total_pages?: number } }
}

export class AushaClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken.trim()) throw new ConnectorError('Jeton Ausha manquant.', 'missing_token')
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${AUSHA_API}${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': 'Aneto/0.4 (+https://aneto-analyse.vercel.app)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')
      if (response.status === 429) {
        throw new ConnectorError('Quota Ausha atteint.', 'rate_limited', retryAfter ? Number(retryAfter) : 60)
      }
      if (response.status === 401 || response.status === 403) {
        throw new ConnectorError('Jeton Ausha refusé.', 'unauthorized')
      }
      throw new ConnectorError(`Ausha a répondu avec le statut ${response.status}.`, 'upstream_error')
    }

    return response.json() as Promise<T>
  }

  async verifyShow(showId: string) {
    const result = await this.request<{ data?: { id?: number | string; name?: string } }>(`/shows/${encodeURIComponent(showId)}`)
    if (!result.data?.id) throw new ConnectorError('Émission Ausha introuvable.', 'invalid_show')
    return { id: String(result.data.id), name: result.data.name ?? `Show ${result.data.id}` }
  }

  async listEpisodes(showId: string): Promise<NormalizedContentItem[]> {
    const items: NormalizedContentItem[] = []
    let page = 1
    let totalPages = 1

    do {
      const collection = await this.request<AushaCollection>(`/shows/${encodeURIComponent(showId)}/podcasts?per_page=100&page=${page}`)
      for (const podcast of collection.data ?? []) items.push(normalizeAushaPodcast(podcast) as NormalizedContentItem)
      totalPages = Math.max(1, Number(collection.meta?.pagination?.total_pages ?? 1))
      page += 1
    } while (page <= totalPages && page <= 100)

    return items
  }
}
