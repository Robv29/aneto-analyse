const stopWords = new Set([
  'avec', 'dans', 'pour', 'mais', 'plus', 'tout', 'tous', 'toutes', 'cette', 'comment', 'pourquoi', 'sans', 'chez',
  'the', 'and', 'with', 'from', 'that', 'this', 'your', 'you', 'une', 'des', 'les', 'sur', 'est', 'sont', 'leur',
])

const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export function primaryMetric(item) {
  return item?.provider === 'youtube' || item?.kind === 'video'
    ? finiteNumber(item?.payload?.viewCount)
    : finiteNumber(item?.payload?.downloadsCount)
}

export function parseDurationSeconds(item) {
  if (Number.isFinite(Number(item?.payload?.durationSeconds))) return Number(item.payload.durationSeconds)
  const duration = String(item?.payload?.duration ?? '')
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return 0
  return finiteNumber(match[1]) * 3600 + finiteNumber(match[2]) * 60 + finiteNumber(match[3])
}

export function extractTopics(items, limit = 6) {
  const topics = new Map()
  const add = (raw) => {
    const label = String(raw ?? '').trim().replace(/^#/, '')
    const key = label.toLocaleLowerCase('fr-FR')
    if (label.length < 4 || stopWords.has(key) || /^\d+$/.test(key)) return
    const current = topics.get(key) ?? { label, count: 0 }
    current.count += 1
    topics.set(key, current)
  }

  items.forEach((item) => {
    const tags = Array.isArray(item?.payload?.tags) ? item.payload.tags : []
    if (tags.length) tags.slice(0, 12).forEach(add)
    else String(item?.title ?? '').split(/[^\p{L}\p{N}]+/u).forEach(add)
  })

  return [...topics.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr')).slice(0, limit)
}

export function analyzeContent(items) {
  const content = Array.isArray(items) ? items : []
  const ranked = [...content].sort((a, b) => primaryMetric(b) - primaryMetric(a))
  const totalPrimary = content.reduce((sum, item) => sum + primaryMetric(item), 0)
  const totalViews = content.reduce((sum, item) => sum + finiteNumber(item?.payload?.viewCount), 0)
  const totalLikes = content.reduce((sum, item) => sum + finiteNumber(item?.payload?.likeCount), 0)
  const totalComments = content.reduce((sum, item) => sum + finiteNumber(item?.payload?.commentCount), 0)
  const durations = content.map(parseDurationSeconds).filter(Boolean)
  const topics = extractTopics(content)

  return {
    count: content.length,
    ranked,
    top: ranked[0] ?? null,
    totalPrimary,
    totalViews,
    totalLikes,
    totalComments,
    averagePrimary: content.length ? Math.round(totalPrimary / content.length) : 0,
    averageDurationSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    engagementRate: totalViews ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
    coverage: content.length ? Math.round((content.filter((item) => primaryMetric(item) > 0).length / content.length) * 100) : 0,
    topics,
  }
}
