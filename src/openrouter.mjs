const clean = (value, limit) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
  : ''

const cleanList = (value, limit, itemLimit) => Array.isArray(value)
  ? [...new Set(value.map((item) => clean(item, itemLimit)).filter(Boolean))].slice(0, limit)
  : []

const cleanHashtag = (value) => {
  const normalized = clean(value, 40).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
  return normalized.length > 1 ? `#${normalized}` : ''
}

export function extractOpenRouterJson(value) {
  const text = String(value ?? '')
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
}

export function validateOpenRouterMarketStudy(payload) {
  const study = payload?.market_study
  if (!study || typeof study !== 'object') return null
  const opportunity = clean(study.opportunity, 320)
  const audience = clean(study.audience, 240)
  const differentiation = clean(study.differentiation, 320)
  const marketSignal = clean(study.market_signal, 320)
  if (!opportunity || !audience || !differentiation || !marketSignal) return null
  return { opportunity, audience, differentiation, marketSignal }
}

export function validateOpenRouterEditorial(payload, allowedIds) {
  const clips = Array.isArray(payload?.clips) ? payload.clips : []
  const allowed = new Set(allowedIds)
  const seen = new Set()
  return clips.flatMap((item, index) => {
    const candidateId = clean(item?.candidate_id, 120)
    const title = clean(item?.title, 90)
    const publicationHook = clean(item?.publication_hook, 170)
    const rationale = clean(item?.rationale, 260)
    const marketAngle = clean(item?.market_angle, 260)
    const caption = clean(item?.caption, 900)
    const targetAudience = clean(item?.target_audience, 180)
    const hashtags = [...new Set(cleanList(item?.hashtags, 10, 40).map(cleanHashtag).filter(Boolean))]
    const platformFit = cleanList(item?.platform_fit, 3, 18)
    if (!allowed.has(candidateId) || seen.has(candidateId) || title.length < 5 || publicationHook.length < 8 || rationale.length < 12 || marketAngle.length < 12 || caption.length < 20 || targetAudience.length < 5 || hashtags.length < 3) return []
    seen.add(candidateId)
    return [{ candidateId, title, publicationHook, rationale, marketAngle, caption, targetAudience, hashtags, platformFit, rank: index + 1 }]
  }).slice(0, 8)
}

export function buildClipCopyText(clip) {
  const title = clean(clip?.title, 120)
  const caption = clean(clip?.caption, 1200)
  const hashtags = Array.isArray(clip?.hashtags) ? clip.hashtags.map(cleanHashtag).filter(Boolean).join(' ') : ''
  return [title, caption, hashtags].filter(Boolean).join('\n\n')
}
