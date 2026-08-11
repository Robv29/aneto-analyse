import 'server-only'
import { extractOpenRouterJson, validateOpenRouterEditorial } from '@/src/openrouter.mjs'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export type EditorialClipInput = {
  id: string
  start: number
  end: number
  score: number
  excerpt: string
  reasons: string[]
}

export type EditorialClip = {
  candidateId: string
  title: string
  publicationHook: string
  rationale: string
  rank: number
}

type OpenRouterPayload = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
  model?: string
  error?: { message?: string }
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export async function enrichEditorialClips(videoTitle: string, candidates: EditorialClipInput[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')
  if (!candidates.length) return { clips: [] as EditorialClip[], model: null }

  const requestedModel = process.env.OPENROUTER_MODEL || 'openrouter/free'
  const candidatePayload = candidates.slice(0, 8).map((candidate) => ({
    candidate_id: candidate.id,
    timecode: `${candidate.start}-${candidate.end}`,
    score_mesure: candidate.score,
    raisons_mesurees: candidate.reasons,
    transcription_exacte: candidate.excerpt,
  }))
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
      max_tokens: 1100,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Tu es le directeur éditorial d’un média français premium. Tu sélectionnes des extraits de vidéos longues pour en faire des Shorts, Reels et TikTok. Tu n’inventes jamais un fait, une citation, un timecode ou une émotion absente de la transcription. Tu réponds uniquement en JSON valide.',
        },
        {
          role: 'user',
          content: `Vidéo : ${videoTitle}\n\nVoici des passages réels déjà minutés :\n${JSON.stringify(candidatePayload)}\n\nChoisis au maximum 3 passages réellement autonomes et forts. Classe-les. Pour chacun, écris :\n- candidate_id : exactement l’identifiant fourni ;\n- title : titre court, précis, non putaclic, 70 caractères maximum ;\n- publication_hook : texte d’accroche à afficher au début du short. Il peut reformuler, mais ne doit ajouter aucun fait ;\n- rationale : pourquoi ce passage mérite d’être coupé, en une phrase concrète.\n\nFormat obligatoire : {"clips":[{"candidate_id":"…","title":"…","publication_hook":"…","rationale":"…"}]}`,
        },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  })
  const payload = await response.json() as OpenRouterPayload
  if (!response.ok) throw new Error(payload.error?.message ?? `openrouter_${response.status}`)
  const rawContent = payload.choices?.[0]?.message?.content
  const content = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent) ? rawContent.map((part) => part.text ?? '').join('') : ''
  if (!content) throw new Error('openrouter_empty_response')
  const clips = validateOpenRouterEditorial(extractOpenRouterJson(content), candidates.map((candidate) => candidate.id)) as EditorialClip[]
  if (!clips.length) throw new Error('openrouter_invalid_editorial_response')
  return { clips, model: payload.model ?? requestedModel }
}
