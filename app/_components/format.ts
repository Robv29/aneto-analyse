import type { LibraryItem } from '@/lib/data/loaders'

export const compactNumber = (value: unknown) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
  : '—'

export const fullNumber = (value: unknown) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('fr-FR').format(Number(value))
  : '—'

export const formatDuration = (seconds: number) => seconds
  ? `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60}s` : ''}`
  : '—'

export const providerLabel = (provider: string) =>
  provider === 'youtube' ? 'YouTube' : provider === 'ausha' ? 'Ausha' : provider === 'tiktok' ? 'TikTok' : provider

export const metricLabel = (item: Pick<LibraryItem, 'kind'>) => item.kind === 'video' ? 'vues' : 'écoutes'

export const contentHref = (item: LibraryItem): string | null => {
  if (item.transcript?.status === 'available') return `/transcripts/${encodeURIComponent(item.id)}`
  if (item.provider === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(item.externalId)}`
  if (item.provider === 'tiktok' && typeof item.payload.shareUrl === 'string') return item.payload.shareUrl
  return null
}

export const pluralize = (count: number, singular: string, plural?: string) =>
  count > 1 ? (plural ?? `${singular}s`) : singular
