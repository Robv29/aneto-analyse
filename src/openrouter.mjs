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

// Choix produit : Aneto utilise le quota gratuit quotidien d'OpenRouter.
// Les variantes ":free" nominatives sont régulièrement retirées du catalogue,
// donc elles passent par le pool "openrouter/free" qui route vers les modèles
// gratuits encore disponibles. Un modèle payant explicite reste respecté via
// OPENROUTER_MODEL pour une qualité plus constante.
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free'

export function resolveOpenRouterModel(value) {
  const configured = clean(value, 160)
  if (!configured || configured.endsWith(':free')) return DEFAULT_OPENROUTER_MODEL
  return configured
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
  const limits = clean(study.limits, 320)
  const nextTest = clean(study.next_test, 320)
  if (!opportunity || !audience || !differentiation || !marketSignal || !limits || !nextTest) return null
  return { opportunity, audience, differentiation, marketSignal, limits, nextTest }
}

const score10 = (value) => {
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 10 ? Math.round(score) : null
}

// Le kit minimal exigé pour publier : titre, hook, texte, hashtags, scorecard.
// Le reste (rationale, risque, angle…) est conservé quand le modèle le fournit,
// mais son absence ne fait plus tomber le kit.
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
    const whyNow = clean(item?.why_now, 260)
    const risk = clean(item?.risk, 260)
    const testHypothesis = clean(item?.test_hypothesis, 260)
    const hashtags = [...new Set(cleanList(item?.hashtags, 10, 40).map(cleanHashtag).filter(Boolean))]
    const platformFit = cleanList(item?.platform_fit, 3, 18)
    const scorecard = {
      hook: score10(item?.scorecard?.hook),
      autonomy: score10(item?.scorecard?.autonomy),
      tension: score10(item?.scorecard?.tension),
      conversation: score10(item?.scorecard?.conversation),
      fidelity: score10(item?.scorecard?.fidelity),
    }
    if (!allowed.has(candidateId) || seen.has(candidateId) || title.length < 5 || publicationHook.length < 8 || caption.length < 20 || hashtags.length < 3 || Object.values(scorecard).some((score) => score === null)) return []
    seen.add(candidateId)
    return [{ candidateId, title, publicationHook, rationale, marketAngle, caption, targetAudience, whyNow, risk, testHypothesis, scorecard, hashtags, platformFit, rank: index + 1 }]
  }).slice(0, 4)
}

export function buildClipCopyText(clip) {
  const title = clean(clip?.title, 120)
  const caption = clean(clip?.caption, 1200)
  const hashtags = Array.isArray(clip?.hashtags) ? clip.hashtags.map(cleanHashtag).filter(Boolean).join(' ') : ''
  return [title, caption, hashtags].filter(Boolean).join('\n\n')
}
