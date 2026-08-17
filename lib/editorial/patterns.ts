import { parseDurationSeconds, primaryMetric } from '@/src/analytics.mjs'
import type { LibraryItem } from '@/lib/data/loaders'

export type PatternRow = {
  label: string
  count: number
  average: number
  lift: number
}

export type PerformancePatterns = {
  sampleSize: number
  medianPrimary: number
  byPlatform: Array<{ provider: string; count: number; median: number; engagementRate: number | null }>
  byDuration: PatternRow[]
  byTheme: PatternRow[]
  byHashtag: PatternRow[]
  byHookType: PatternRow[]
  byDay: PatternRow[]
}

const DURATION_BUCKETS: Array<{ label: string; max: number }> = [
  { label: '≤ 45 s', max: 45 },
  { label: '45 s – 3 min', max: 180 },
  { label: '3 – 10 min', max: 600 },
  { label: '10 – 25 min', max: 1500 },
  { label: '> 25 min', max: Infinity },
]

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const hookType = (title: string) => {
  if (/\?/.test(title)) return 'question'
  if (/\b\d[\d\s.,%€kKmM]*\b/.test(title)) return 'chiffre / enjeu concret'
  if (/\b(mais|pourtant|jamais|sans|contre|arrête|erreur|piège)\b/i.test(title)) return 'contraste / rupture'
  if (/\b(je|j['’]|mon|ma|mes|on a)\b/i.test(title)) return 'expérience personnelle'
  return 'affirmation simple'
}

function aggregate(groups: Map<string, number[]>, globalMedian: number, minCount = 2, top = 8): PatternRow[] {
  return [...groups.entries()]
    .filter(([, values]) => values.length >= minCount)
    .map(([label, values]) => {
      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      return {
        label,
        count: values.length,
        average,
        lift: globalMedian ? Number((average / globalMedian).toFixed(2)) : 0,
      }
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, top)
}

const push = (groups: Map<string, number[]>, key: string, value: number) => {
  const list = groups.get(key) ?? []
  list.push(value)
  groups.set(key, list)
}

// Croise tous les contenus synchronisés (toutes plateformes) et mesure ce qui
// performe : durée, thèmes, type de hook du titre, hashtags, jour. Pur calcul,
// aucune requête ni IA.
export function computePerformancePatterns(library: LibraryItem[]): PerformancePatterns {
  const items = library.filter((item) => primaryMetric(item) > 0)
  const primaries = items.map((item) => primaryMetric(item) as number)
  const globalMedian = median(primaries)

  const platformGroups = new Map<string, LibraryItem[]>()
  const durationGroups = new Map<string, number[]>()
  const themeGroups = new Map<string, number[]>()
  const hashtagGroups = new Map<string, number[]>()
  const hookGroups = new Map<string, number[]>()
  const dayGroups = new Map<string, number[]>()

  for (const item of items) {
    const value = primaryMetric(item) as number

    const platformList = platformGroups.get(item.provider) ?? []
    platformList.push(item)
    platformGroups.set(item.provider, platformList)

    const duration = parseDurationSeconds({ payload: item.payload }) as number
    if (duration > 0) {
      const bucket = DURATION_BUCKETS.find((entry) => duration <= entry.max)
      if (bucket) push(durationGroups, bucket.label, value)
    }

    const keywords = item.transcript?.keywords?.length
      ? item.transcript.keywords
      : Array.isArray(item.payload.tags) ? (item.payload.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string') : []
    for (const keyword of keywords.slice(0, 8)) {
      const label = keyword.toLocaleLowerCase('fr-FR').replace(/^#/, '')
      if (label.length >= 4) push(themeGroups, label, value)
    }

    const hashtagSources = [
      item.title,
      typeof item.payload.description === 'string' ? item.payload.description : '',
    ].join(' ')
    for (const tag of hashtagSources.match(/#[\p{L}\p{N}_]+/gu) ?? []) {
      push(hashtagGroups, tag.toLocaleLowerCase('fr-FR'), value)
    }
    if (Array.isArray(item.payload.tags)) {
      for (const tag of (item.payload.tags as unknown[]).filter((entry): entry is string => typeof entry === 'string').slice(0, 8)) {
        push(hashtagGroups, `#${tag.toLocaleLowerCase('fr-FR').replace(/^#/, '').replace(/\s+/g, '')}`, value)
      }
    }

    push(hookGroups, hookType(item.title), value)

    if (item.publishedAt) {
      const day = DAYS[new Date(item.publishedAt).getDay()]
      if (day) push(dayGroups, day, value)
    }
  }

  return {
    sampleSize: items.length,
    medianPrimary: globalMedian,
    byPlatform: [...platformGroups.entries()].map(([provider, list]) => {
      const views = list.reduce((sum, item) => sum + (Number(item.payload.viewCount) || 0), 0)
      const reactions = list.reduce((sum, item) => sum + (Number(item.payload.likeCount) || 0) + (Number(item.payload.commentCount) || 0), 0)
      return {
        provider,
        count: list.length,
        median: median(list.map((item) => primaryMetric(item) as number)),
        engagementRate: views ? Number(((reactions / views) * 100).toFixed(1)) : null,
      }
    }).sort((a, b) => b.median - a.median),
    byDuration: aggregate(durationGroups, globalMedian, 1, 6),
    byTheme: aggregate(themeGroups, globalMedian, 2, 8),
    byHashtag: aggregate(hashtagGroups, globalMedian, 2, 8),
    byHookType: aggregate(hookGroups, globalMedian, 1, 5),
    byDay: aggregate(dayGroups, globalMedian, 1, 7),
  }
}
