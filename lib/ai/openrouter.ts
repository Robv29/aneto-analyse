import 'server-only'
import { extractOpenRouterJson, resolveOpenRouterModel, validateOpenRouterEditorial, validateOpenRouterMarketStudy, validatePerformanceInsights } from '@/src/openrouter.mjs'

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
  const candidatePayload = video.candidates.slice(0, 6).map((candidate) => ({
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
      max_tokens: 2600,
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimited = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('429') || message.includes('rate') || message.includes('quota') || message.includes('capacity')
}

// Le quota gratuit d'OpenRouter refuse les appels simultanés : les vidéos sont
// donc analysées une par une, avec une pause entre chaque et un réessai sur
// saturation. On s'arrête avant la limite d'exécution de la plateforme ; les
// vidéos non traitées restent en attente pour le prochain lancement.
export async function enrichEditorialClips(videos: EditorialVideoInput[], options: { budgetMs?: number } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')
  const selectedVideos = videos.filter((video) => video.candidates.length)
  if (!selectedVideos.length) {
    return { analyses: [] as EditorialVideoAnalysis[], requestCount: 0, succeeded: 0, failed: 0, remaining: 0 }
  }

  const budgetMs = options.budgetMs ?? 45_000
  const startedAt = Date.now()
  const performances = selectedVideos.map((video) => video.views).filter((value) => value > 0).sort((a, b) => a - b)
  const benchmark = {
    videos_comparees: selectedVideos.length,
    vues_medianes: performances.length ? performances[Math.floor(performances.length / 2)] : 0,
    vues_maximales: Math.max(0, ...performances),
    reactions_totales: selectedVideos.reduce((sum, video) => sum + video.likes + video.comments, 0),
  }

  const analyses: EditorialVideoAnalysis[] = []
  let attempted = 0
  let failed = 0
  let lastError: unknown = null

  for (const [index, video] of selectedVideos.entries()) {
    // Il faut au moins ~18 s de marge pour tenter une analyse complète.
    if (Date.now() - startedAt > budgetMs - 18_000) break
    if (index > 0) await wait(1_200)
    attempted += 1

    try {
      analyses.push(await analyzeOneVideo(video, benchmark, apiKey))
    } catch (error) {
      lastError = error
      // Une saturation du quota gratuit se retente une fois, après une pause.
      if (isRateLimited(error) && Date.now() - startedAt < budgetMs - 25_000) {
        await wait(4_000)
        try {
          analyses.push(await analyzeOneVideo(video, benchmark, apiKey))
          continue
        } catch (retryError) {
          lastError = retryError
        }
      }
      failed += 1
      console.error(JSON.stringify({
        event: 'editorial_analysis_failed',
        contentItemId: video.contentItemId,
        error: lastError instanceof Error ? lastError.message.slice(0, 200) : 'unknown',
      }))
    }
  }

  if (!analyses.length) throw lastError ?? new Error('openrouter_no_result')

  return {
    analyses,
    requestCount: attempted,
    succeeded: analyses.length,
    failed,
    remaining: selectedVideos.length - attempted,
  }
}

export type PerformanceInsights = {
  summary: string
  insights: Array<{ finding: string; evidence: string; action: string }>
}

// Lecture IA transverse : reçoit les statistiques agrégées calculées sur tous
// les réseaux synchronisés et en tire ce qui marche le mieux.
export async function analyzePerformancePatterns(patterns: unknown): Promise<{ result: PerformanceInsights; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')

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
      temperature: .3,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es un analyste growth pour créateurs de contenu. On te fournit des statistiques agrégées calculées sur les contenus réellement synchronisés d'un créateur (toutes plateformes confondues), avec pour chaque dimension la moyenne de vues et le "lift" par rapport à la médiane globale.

RÈGLES
- Tu n'utilises QUE les chiffres fournis. Aucune tendance externe, aucune invention.
- Chaque enseignement cite son chiffre (evidence) : moyenne, lift ou effectif.
- Si un effectif est faible (count < 3), l'enseignement le signale comme fragile.
- Chaque enseignement se termine par une action concrète applicable à la prochaine publication.
- Couvre en priorité : durée idéale, thèmes gagnants, type de hook de titre, hashtags, plateforme et jour si les données existent.

Réponds uniquement en JSON valide :
{"summary":"lecture d'ensemble en 2 phrases","insights":[{"finding":"…","evidence":"…","action":"…"}]}`,
        },
        {
          role: 'user',
          content: `Statistiques agrégées du créateur : ${JSON.stringify(patterns)}

Donne 4 à 6 enseignements, du plus actionnable au moins actionnable.`,
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
  const result = validatePerformanceInsights(extractOpenRouterJson(content)) as PerformanceInsights | null
  if (!result) throw new Error('openrouter_invalid_insights_response')
  return { result, model: payload.model ?? requestedModel }
}
