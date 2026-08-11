const stopWords = new Set([
  'alors', 'après', 'assez', 'aussi', 'autre', 'avant', 'avec', 'avoir', 'beaucoup', 'bien', 'bonne', 'cette', 'chez',
  'chose', 'comme', 'comment', 'contre', 'dans', 'depuis', 'donc', 'elle', 'elles', 'encore', 'entre', 'être', 'faire',
  'fait', 'fois', 'juste', 'leurs', 'mais', 'même', 'moins', 'notre', 'nous', 'parce', 'parfois', 'pendant', 'petit',
  'pense', 'penser', 'peut', 'plus', 'pour', 'pourquoi', 'premier', 'quand', 'quelque', 'sans', 'savoir', 'sont', 'surtout', 'très',
  'tous', 'toute', 'toutes', 'trouve', 'votre', 'vraiment', 'voilà', 'vous', 'allait', 'avait', 'c’est', 'dire', 'disons', 'était', 'genre', 'peuvent',
  'the', 'and', 'with', 'from', 'that', 'this', 'your', 'you', 'une', 'des', 'les', 'sur', 'est', 'leur',
])

const meaningfulTopic = (value) => {
  const label = String(value ?? '').trim().replace(/^#/, '')
  const key = label.toLocaleLowerCase('fr-FR')
  return label.length >= 4 && !stopWords.has(key) && !/^\d+$/.test(key)
}

const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export function extractTranscriptKeywords(text, limit = 12) {
  const frequencies = new Map()
  String(text ?? '').split(/[^\p{L}\p{N}]+/u).forEach((raw) => {
    const word = raw.trim()
    const key = word.toLocaleLowerCase('fr-FR')
    if (!meaningfulTopic(key)) return
    const current = frequencies.get(key) ?? { label: key, count: 0 }
    current.count += 1
    frequencies.set(key, current)
  })
  return [...frequencies.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr')).slice(0, limit).map((entry) => entry.label)
}

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
    if (!meaningfulTopic(label)) return
    const current = topics.get(key) ?? { label, count: 0 }
    current.count += 1
    topics.set(key, current)
  }

  items.forEach((item) => {
    const transcriptKeywords = Array.isArray(item?.transcript?.keywords) ? item.transcript.keywords.filter(meaningfulTopic) : []
    const tags = transcriptKeywords.length ? transcriptKeywords : (Array.isArray(item?.payload?.tags) ? item.payload.tags : [])
    if (tags.length) tags.slice(0, 12).forEach(add)
    else String(item?.title ?? '').split(/[^\p{L}\p{N}]+/u).forEach(add)
  })

  return [...topics.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr')).slice(0, limit)
}

export function editorialSignal(topics, minimumOccurrences = 2) {
  const topic = Array.isArray(topics) ? topics.find((entry) => meaningfulTopic(entry?.label) && Number(entry?.count) >= minimumOccurrences) : null
  return topic ?? null
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
