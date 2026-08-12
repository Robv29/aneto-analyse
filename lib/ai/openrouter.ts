import 'server-only'
import { extractOpenRouterJson, resolveOpenRouterModel, validateOpenRouterEditorial, validateOpenRouterMarketStudy } from '@/src/openrouter.mjs'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export type EditorialClipInput = {
  id: string
  start: number
  end: number
  score: number
  excerpt: string
  reasons: string[]
}

export type EditorialVideoInput = {
  contentItemId: string
  title: string
  publishedAt: string | null
  views: number
  likes: number
  comments: number
  tags: string[]
  candidates: EditorialClipInput[]
}

export type EditorialClip = {
  candidateId: string
  title: string
  publicationHook: string
  rationale: string
  marketAngle: string
  caption: string
  targetAudience: string
  whyNow: string
  risk: string
  testHypothesis: string
  scorecard: { hook: number; autonomy: number; tension: number; conversation: number; fidelity: number }
  hashtags: string[]
  platformFit: string[]
  rank: number
}

export type EditorialMarketStudy = {
  opportunity: string
  audience: string
  differentiation: string
  marketSignal: string
  limits: string
  nextTest: string
}

type OpenRouterPayload = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
  model?: string
  error?: { message?: string }
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

const clipAverage = (clip: EditorialClip) => Object.values(clip.scorecard).reduce((sum, score) => sum + score, 0) / 5

async function analyzeOneVideo(video: EditorialVideoInput, benchmark: Record<string, number>, apiKey: string) {
  const candidatePayload = video.candidates.slice(0, 4).map((candidate) => ({
    candidate_id: candidate.id,
    timecode_secondes: { debut: candidate.start, fin: candidate.end },
    score_mesure: candidate.score,
    raisons_mesurees: candidate.reasons,
    transcription_exacte: candidate.excerpt,
  }))

  const requestedModel = resolveOpenRouterModel(process.env.OPENROUTER_MODEL)
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.ANETO_APP_URL || 'https://aneto-analyse.vercel.app',
      'X-Title': 'Aneto Media Intelligence',
    },
    body: JSON.stringify({
      model: requestedModel,
      temperature: .2,
      max_tokens: 1250,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es un comité éditorial français : rédaction, montage short-form, audience et fact-checking. Élimine plutôt que flatter. N’invente jamais citation, fait, tendance, émotion, statistique ou timecode. Le corpus est un benchmark interne, pas le marché mondial. Garde au maximum 2 passages autonomes et distincts. Le hook doit rester fidèle au verbatim. Donne un contre-argument et un test mesurable. Les hashtags sont des hypothèses, jamais des tendances. Réponds uniquement en JSON valide.`,
        },
        {
          role: 'user',
          content: `Vidéo : ${JSON.stringify({ titre: video.title, publication: video.publishedAt, vues: video.views, likes: video.likes, commentaires: video.comments, tags: video.tags.slice(0, 6) })}
Benchmark global : ${JSON.stringify(benchmark)}
Passages : ${JSON.stringify(candidatePayload)}

Compare les passages et conserve 0 à 2 finalistes. Le diagnostic doit être concis. scorecard contient 5 notes entières sur 10. test_hypothesis suit « Si…, alors…, mesuré par… ». caption fait moins de 400 caractères. hashtags contient 4 à 6 éléments.

Format obligatoire :
{"market_study":{"opportunity":"…","audience":"…","differentiation":"…","market_signal":"…","limits":"…","next_test":"…"},"clips":[{"candidate_id":"…","title":"…","publication_hook":"…","rationale":"…","market_angle":"…","target_audience":"…","why_now":"…","risk":"…","test_hypothesis":"…","scorecard":{"hook":0,"autonomy":0,"tension":0,"conversation":0,"fidelity":0},"caption":"…","hashtags":["#…"],"platform_fit":["…"]}]}`,
        },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(55_000),
  })
  const payload = await response.json() as OpenRouterPayload
  if (!response.ok) throw new Error(payload.error?.message ?? `openrouter_${response.status}`)
  const rawContent = payload.choices?.[0]?.message?.content
  const content = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent) ? rawContent.map((part) => part.text ?? '').join('') : ''
  if (!content) throw new Error('openrouter_empty_response')
  const parsed = extractOpenRouterJson(content)
  const clips = validateOpenRouterEditorial(parsed, candidatePayload.map((candidate) => candidate.candidate_id)) as EditorialClip[]
  const marketStudy = validateOpenRouterMarketStudy(parsed) as EditorialMarketStudy | null
  if (!marketStudy) throw new Error('openrouter_invalid_editorial_response')
  return { contentItemId: video.contentItemId, clips: clips.slice(0, 2), marketStudy, model: payload.model ?? requestedModel }
}

export async function enrichEditorialClips(videos: EditorialVideoInput[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')
  const selectedVideos = videos.filter((video) => video.candidates.length).slice(0, 4)
  if (!selectedVideos.length) return { clips: [] as EditorialClip[], marketStudy: null as EditorialMarketStudy | null, model: null, requestCount: 0, succeeded: 0, failed: 0, analyzedVideoIds: [] as string[] }

  const performances = selectedVideos.map((video) => video.views).filter((value) => value > 0).sort((a, b) => a - b)
  const benchmark = {
    videos_comparees: selectedVideos.length,
    vues_medianes: performances.length ? performances[Math.floor(performances.length / 2)] : 0,
    vues_maximales: Math.max(0, ...performances),
    reactions_totales: selectedVideos.reduce((sum, video) => sum + video.likes + video.comments, 0),
  }
  const settled = await Promise.allSettled(selectedVideos.map((video) => analyzeOneVideo(video, benchmark, apiKey)))
  const successes = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  if (!successes.length) {
    const firstFailure = settled.find((result) => result.status === 'rejected')
    throw firstFailure?.status === 'rejected' ? firstFailure.reason : new Error('openrouter_no_result')
  }

  const measuredScores = new Map(selectedVideos.flatMap((video) => video.candidates.map((candidate) => [candidate.id, candidate.score])))
  const clips = successes.flatMap((result) => result.clips)
    .sort((a, b) => (clipAverage(b) * .7 + (measuredScores.get(b.candidateId) ?? 0) / 10 * .3) - (clipAverage(a) * .7 + (measuredScores.get(a.candidateId) ?? 0) / 10 * .3))
    .slice(0, 4)
    .map((clip, index) => ({ ...clip, rank: index + 1 }))
  const winningStudy = successes.find((result) => result.clips.some((clip) => clip.candidateId === clips[0]?.candidateId))?.marketStudy ?? successes[0].marketStudy
  return {
    clips,
    marketStudy: winningStudy,
    model: [...new Set(successes.map((result) => result.model))].join(', '),
    requestCount: selectedVideos.length,
    succeeded: successes.length,
    failed: selectedVideos.length - successes.length,
    analyzedVideoIds: successes.map((result) => result.contentItemId),
  }
}
