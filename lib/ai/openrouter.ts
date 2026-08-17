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

// Version du protocole d'analyse : l'incrémenter invalide les analyses
// existantes et permet de relancer l'enrichissement sans toucher aux données.
// v6 : orientation viralité — un kit complet (titre, texte, hashtags) pour
// chaque passage transmis, plus aucune élimination.
export const EDITORIAL_ANALYSIS_VERSION = 6

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export const clipScorecardAverage = (clip: Pick<EditorialClip, 'scorecard'>) =>
  Object.values(clip.scorecard).reduce((sum, score) => sum + score, 0) / 5

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
      temperature: .4,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es un stratège short-form français, expert de ce qui devient viral sur TikTok, YouTube Shorts et Reels. Ta mission : transformer des passages réellement prononcés en shorts à fort potentiel de partage.

RÈGLES NON NÉGOCIABLES
- N'invente jamais citation, fait, chiffre, émotion ou timecode : tout part du verbatim fourni.
- Chaque passage transmis reçoit son kit de publication complet. Aucune élimination.
- Le titre promet, le passage paie : pas de clickbait que le verbatim ne tient pas.

LEVIERS DE VIRALITÉ À ACTIVER
- Hook : les 2 premières secondes doivent créer un manque (question ouverte, contradiction, enjeu chiffré, début d'histoire). Jamais de mise en contexte.
- Émotion dominante unique par short : surprise, indignation, identification ou inspiration.
- Identification : le spectateur doit penser « c'est exactement moi » ou « je dois l'envoyer à quelqu'un ».
- Conversation : la caption se termine par une question ou une prise de position clivante qui force le commentaire.
- Boucle : titre et hook ouvrent une question à laquelle seul le visionnage complet répond.

LIVRABLES PAR PASSAGE
- title : ≤ 60 caractères, formulé comme un hook (curiosité, enjeu, contradiction), sans emoji.
- publication_hook : la phrase d'ouverture à afficher à l'écran, fidèle au verbatim.
- caption : 150 à 400 caractères — 1 phrase choc, 1 à 2 phrases qui montent l'enjeu, puis une question finale qui fait commenter. Emojis sobres autorisés (2 max).
- hashtags : 5 à 8 — mélange de 2-3 larges à fort volume, 2-3 de niche collés au sujet, 1 de format (#shorts, #podcast…). Sans espaces ni accents.
- platform_fit : la ou les plateformes où ce passage a le plus de chances, avec les codes de chacune en tête.
- scorecard : 5 notes entières sur 10 — hook, autonomy (se comprend sans contexte), tension, conversation (fait réagir), fidelity (fidélité au verbatim).
- rationale : en une phrase, le mécanisme viral de ce passage.
- risk : en une phrase, ce qui peut faire flopper.

Réponds uniquement en JSON valide.`,
        },
        {
          role: 'user',
          content: `Vidéo source : ${JSON.stringify({ titre: video.title, publication: video.publishedAt, vues: video.views, likes: video.likes, commentaires: video.comments, tags: video.tags.slice(0, 6) })}
Benchmark interne de la chaîne : ${JSON.stringify(benchmark)}
Passages (verbatim exact + timecodes) : ${JSON.stringify(candidatePayload)}

Fournis un kit de publication pour CHAQUE passage, classé du plus fort potentiel viral au plus faible. Ajoute une courte lecture stratégique (market_study) de la vidéo : l'opportunité, l'audience à viser, la différenciation, le signal observé dans les chiffres fournis, les limites, le prochain test.

Format obligatoire :
{"market_study":{"opportunity":"…","audience":"…","differentiation":"…","market_signal":"…","limits":"…","next_test":"…"},"clips":[{"candidate_id":"…","title":"…","publication_hook":"…","rationale":"…","risk":"…","scorecard":{"hook":0,"autonomy":0,"tension":0,"conversation":0,"fidelity":0},"caption":"…","hashtags":["#…"],"platform_fit":["…"]}]}`,
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
  // Chaque passage doit ressortir avec son kit ; une réponse sans aucun kit
  // valide est une analyse ratée, à relancer.
  if (!clips.length) throw new Error('openrouter_invalid_editorial_response')
  return { contentItemId: video.contentItemId, clips, marketStudy, model: payload.model ?? requestedModel }
}

export type EditorialVideoAnalysis = {
  contentItemId: string
  clips: EditorialClip[]
  marketStudy: EditorialMarketStudy | null
  model: string
}

export async function enrichEditorialClips(videos: EditorialVideoInput[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')
  const selectedVideos = videos.filter((video) => video.candidates.length).slice(0, 4)
  if (!selectedVideos.length) {
    return { analyses: [] as EditorialVideoAnalysis[], requestCount: 0, succeeded: 0, failed: 0 }
  }

  const performances = selectedVideos.map((video) => video.views).filter((value) => value > 0).sort((a, b) => a - b)
  const benchmark = {
    videos_comparees: selectedVideos.length,
    vues_medianes: performances.length ? performances[Math.floor(performances.length / 2)] : 0,
    vues_maximales: Math.max(0, ...performances),
    reactions_totales: selectedVideos.reduce((sum, video) => sum + video.likes + video.comments, 0),
  }
  const settled = await Promise.allSettled(selectedVideos.map((video) => analyzeOneVideo(video, benchmark, apiKey)))
  const analyses = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  if (!analyses.length) {
    const firstFailure = settled.find((result) => result.status === 'rejected')
    throw firstFailure?.status === 'rejected' ? firstFailure.reason : new Error('openrouter_no_result')
  }

  return {
    analyses,
    requestCount: selectedVideos.length,
    succeeded: analyses.length,
    failed: selectedVideos.length - analyses.length,
  }
}
