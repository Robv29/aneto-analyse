const clean = (value, limit) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
  : ''

export function extractOpenRouterJson(value) {
  const text = String(value ?? '')
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
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
    if (!allowed.has(candidateId) || seen.has(candidateId) || title.length < 5 || publicationHook.length < 8 || rationale.length < 12) return []
    seen.add(candidateId)
    return [{ candidateId, title, publicationHook, rationale, rank: index + 1 }]
  }).slice(0, 3)
}
