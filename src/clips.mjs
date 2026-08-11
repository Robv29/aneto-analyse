const decodeEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')

const cleanCaption = (value) => decodeEntities(value)
  .replace(/<\/?[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const timestampSeconds = (value) => {
  const parts = String(value).trim().replace(',', '.').split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function timedSegmentsFromVtt(vtt) {
  const lines = String(vtt ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const segments = []
  for (let index = 0; index < lines.length; index += 1) {
    const timing = lines[index].match(/^(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}/)
    if (!timing) continue
    const [startRaw, endRaw] = lines[index].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const start = timestampSeconds(startRaw)
    const end = timestampSeconds(endRaw)
    const cue = []
    while (index + 1 < lines.length && lines[index + 1].trim()) cue.push(lines[++index])
    const text = cleanCaption(cue.join(' '))
    if (start === null || end === null || end <= start || !text) continue
    const previous = segments.at(-1)
    if (previous?.text === text && start - previous.end < 1.5) {
      previous.end = Math.max(previous.end, end)
      continue
    }
    segments.push({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), text })
  }
  return segments
}

const signalWords = /\b(jamais|erreur|perdu|perdre|failli|problème|secret|vérité|décidé|décision|risque|peur|argent|million|échec|réussi|réussite|impossible|grave|changé|compris|déclic|refusé|quitté|sauvé)\b/gi
const contrastWords = /\b(mais|pourtant|sauf que|en réalité|contrairement|jusqu['’]à|alors que)\b/i
const fillerStart = /^(donc|voilà|en fait|du coup|eh bien|alors|bon|bah)\s*[,.:;-]?\s*/i

const editorialScore = (text, duration) => {
  const words = text.trim().split(/\s+/).length
  const signals = text.match(signalWords)?.length ?? 0
  let score = 38
  if (/\?/.test(text)) score += 13
  if (contrastWords.test(text)) score += 12
  if (/\b(j['’]ai|je suis|je n['’]|on a|nous avons)\b/i.test(text)) score += 10
  if (/\b\d[\d\s.,%€]*\b/.test(text)) score += 8
  score += Math.min(15, signals * 5)
  if (words >= 65 && words <= 145) score += 8
  if (duration >= 28 && duration <= 55) score += 7
  return Math.max(0, Math.min(100, score))
}

const retentionForRange = (start, end, options) => {
  const duration = Number(options?.durationSeconds)
  const points = Array.isArray(options?.retentionPoints) ? options.retentionPoints : []
  if (!duration || !points.length) return null
  const startRatio = start / duration
  const endRatio = end / duration
  const selected = points.filter((point) => point.elapsedRatio >= startRatio && point.elapsedRatio <= endRatio)
  if (!selected.length) return null
  const average = (key) => selected.reduce((sum, point) => sum + Number(point[key] ?? 0), 0) / selected.length
  return {
    audienceWatchRatio: average('audienceWatchRatio'),
    relativeRetentionPerformance: average('relativeRetentionPerformance'),
  }
}

const combinedScore = (text, duration, start, end, options) => {
  const editorial = editorialScore(text, duration)
  const retention = retentionForRange(start, end, options)
  if (!retention) return { score: editorial, editorialScore: editorial, retention: null }
  const audience = Math.min(1, Math.max(0, retention.audienceWatchRatio)) * 100
  const relative = Math.min(1, Math.max(0, retention.relativeRetentionPerformance)) * 100
  return {
    score: Math.round(editorial * .7 + relative * .2 + audience * .1),
    editorialScore: editorial,
    retention,
  }
}

const firstSentence = (text) => {
  const clean = text.replace(fillerStart, '').trim()
  const sentence = clean.match(/^.{18,150}?[.!?](?=\s|$)/)?.[0] ?? clean.slice(0, 150)
  return sentence.trim().replace(/\s+/g, ' ')
}

const titleFromPassage = (text) => {
  const sentence = firstSentence(text).replace(/[.!?]+$/, '')
  const contrast = sentence.split(contrastWords).map((part) => part?.trim()).filter(Boolean)
  const base = contrast.length > 1 ? contrast.at(-1) : sentence
  const stripped = String(base)
    .replace(/^(je|j['’]|on|nous|c['’]est|ça|il faut)\s*/i, '')
    .replace(fillerStart, '')
    .trim()
  const compact = stripped.length > 68 ? `${stripped.slice(0, 65).replace(/\s+\S*$/, '')}…` : stripped
  if (!compact) return 'Le passage à retenir'
  return compact.charAt(0).toLocaleUpperCase('fr-FR') + compact.slice(1)
}

const reasonsFor = (text, duration) => {
  const reasons = []
  if (/\?/.test(text)) reasons.push('question immédiate')
  if (contrastWords.test(text)) reasons.push('rupture ou contraste')
  if (/\b(j['’]ai|je suis|je n['’]|on a|nous avons)\b/i.test(text)) reasons.push('expérience vécue')
  if (/\b\d[\d\s.,%€]*\b/.test(text)) reasons.push('fait concret')
  if ((text.match(signalWords)?.length ?? 0) > 0) reasons.push('tension narrative')
  if (duration >= 28 && duration <= 55) reasons.push('durée adaptée au short')
  return reasons.slice(0, 4)
}

export function buildClipCandidates(segments, options = {}) {
  const cues = Array.isArray(segments)
    ? segments.filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end) && segment.end > segment.start && segment.text)
    : []
  if (!cues.length) return []

  const seeds = cues.map((segment, index) => ({
    index,
    score: combinedScore(segment.text, segment.end - segment.start, segment.start, segment.end, options).score,
  })).sort((a, b) => b.score - a.score || a.index - b.index)

  const candidates = []
  for (const seed of seeds) {
    const start = cues[seed.index].start
    if (candidates.some((candidate) => Math.abs(candidate.start - start) < 45)) continue
    const selected = []
    for (let index = seed.index; index < cues.length; index += 1) {
      const segment = cues[index]
      if (segment.start - start > 58) break
      selected.push(segment)
      const duration = segment.end - start
      if (duration >= 34 && /[.!?][”"']?$/.test(segment.text)) break
      if (duration >= 48) break
    }
    if (!selected.length) continue
    const end = selected.at(-1).end
    const duration = end - start
    if (duration < 18) continue
    const text = selected.map((segment) => segment.text).filter((value, index, values) => value !== values[index - 1]).join(' ')
    const scoring = combinedScore(text, duration, start, end, options)
    const reasons = reasonsFor(text, duration)
    if (scoring.retention?.relativeRetentionPerformance >= .65) reasons.unshift('pic de rétention mesuré')
    candidates.push({
      id: `${options.videoId ?? 'video'}-${Math.round(start * 1000)}`,
      start: Math.floor(start),
      end: Math.ceil(end),
      duration: Math.ceil(end - start),
      score: scoring.score,
      editorialScore: scoring.editorialScore,
      retention: scoring.retention,
      title: titleFromPassage(text),
      hook: firstSentence(text),
      excerpt: text.length > 420 ? `${text.slice(0, 417).replace(/\s+\S*$/, '')}…` : text,
      reasons: reasons.slice(0, 4),
    })
    if (candidates.length >= Number(options.limit ?? 3)) break
  }
  return candidates.sort((a, b) => b.score - a.score || a.start - b.start)
}

export function formatClipTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = value % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`
}
