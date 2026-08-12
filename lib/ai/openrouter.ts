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

export async function enrichEditorialClips(videos: EditorialVideoInput[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter_not_configured')

  const candidatePayload = videos.flatMap((video) => video.candidates.slice(0, 4).map((candidate) => ({
    candidate_id: candidate.id,
    video: video.title,
    publication: video.publishedAt,
    performance_video: { vues: video.views, likes: video.likes, commentaires: video.comments },
    tags_source: video.tags.slice(0, 8),
    timecode_secondes: { debut: candidate.start, fin: candidate.end },
    score_mesure: candidate.score,
    raisons_mesurees: candidate.reasons,
    transcription_exacte: candidate.excerpt,
  })))
  if (!candidatePayload.length) return { clips: [] as EditorialClip[], marketStudy: null as EditorialMarketStudy | null, model: null }

  const performances = videos.map((video) => video.views).filter((value) => value > 0).sort((a, b) => a - b)
  const internalBenchmark = {
    videos_comparees: videos.length,
    passages_compares: candidatePayload.length,
    vues_medianes: performances.length ? performances[Math.floor(performances.length / 2)] : 0,
    vues_maximales: Math.max(0, ...performances),
    reactions_totales: videos.reduce((sum, video) => sum + video.likes + video.comments, 0),
  }

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
      temperature: .25,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es un comité de sélection éditoriale composé de quatre regards contradictoires : rédacteur en chef, monteur short-form, stratège audience et fact-checker. Tu dois rendre une seule décision commune. Ta mission n’est ni de résumer ni d’encourager : tu dois éliminer la majorité des passages et défendre seulement ceux qui méritent réellement du temps de montage.

Règles absolues :
- n’invente jamais un fait, une citation, un timecode, une statistique, une tendance ni une émotion absente des données ;
- distingue explicitement fait mesuré, inférence éditoriale et hypothèse à tester ;
- ce corpus est un benchmark INTERNE à la chaîne, jamais une étude du marché mondial ni une preuve de tendance en temps réel ;
- refuse les faux signaux : mots de liaison, généralités, notoriété supposée, chiffres sans contexte et émotion non formulée ;
- élimine tout passage dépendant des 30 secondes précédentes, sans transformation, sans tension ou dont le hook trahit la citation ;
- note chaque finaliste de 0 à 10 sur hook immédiat, autonomie, tension, potentiel de conversation et fidélité au verbatim ;
- cherche le meilleur contre-argument : pourquoi ce cut pourrait ne pas fonctionner ;
- transforme chaque recommandation en test falsifiable avec une variable claire à observer ;
- les hashtags ne sont jamais présentés comme « en vogue » sans source externe datée : ce sont des hypothèses de découvrabilité à tester ;
- garde au maximum 4 extraits réellement distincts, même si davantage sont fournis ;
- réponds uniquement en JSON valide.`,
        },
        {
          role: 'user',
          content: `Analyse comparative unique.

Benchmark interne mesuré :
${JSON.stringify(internalBenchmark)}

Passages réels :
${JSON.stringify(candidatePayload)}

Travail demandé :
1. Établis le diagnostic éditorial interne : opportunité, audience, différenciation, signal observé, limites des données et prochain test décisif. Une phrase dense par rubrique.
2. Mets tous les passages en concurrence. Garde au maximum 4 finalistes. L’ordre du tableau clips est le classement final.
3. Pour chaque extrait retenu, livre un véritable kit de publication :
   - candidate_id : identifiant exact fourni ;
   - title : titre net, spécifique, 70 caractères maximum, sans putaclic ;
   - publication_hook : phrase écran/parlée qui arrête le scroll sans ajouter de fait ;
   - rationale : raison concrète de couper ce passage plutôt qu’un autre ;
   - market_angle : tension, question ou territoire éditorial qui lui donne une place sur le marché ;
   - target_audience : personne précise à qui le publier ;
   - why_now : raison de le publier maintenant, reliée uniquement au benchmark fourni ;
   - risk : meilleur contre-argument expliquant pourquoi il pourrait échouer ;
   - test_hypothesis : hypothèse falsifiable, formulée « Si…, alors…, mesuré par… » ;
   - scorecard : notes entières de 0 à 10 pour hook, autonomy, tension, conversation, fidelity ;
   - caption : texte prêt à publier en français, 400 caractères maximum, fidèle au passage, avec une question finale naturelle ;
   - hashtags : 4 à 6 hypothèses de découvrabilité ciblées, écrites avec #, sans prétendre qu’elles sont tendance ;
   - platform_fit : plateformes les plus adaptées parmi YouTube Shorts, Instagram Reels, TikTok.

Format obligatoire :
{"market_study":{"opportunity":"…","audience":"…","differentiation":"…","market_signal":"…","limits":"…","next_test":"…"},"clips":[{"candidate_id":"…","title":"…","publication_hook":"…","rationale":"…","market_angle":"…","target_audience":"…","why_now":"…","risk":"…","test_hypothesis":"…","scorecard":{"hook":0,"autonomy":0,"tension":0,"conversation":0,"fidelity":0},"caption":"…","hashtags":["#…"],"platform_fit":["…"]}]}`,
        },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(150_000),
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
  if (!clips.length || !marketStudy) throw new Error('openrouter_invalid_editorial_response')
  return { clips, marketStudy, model: payload.model ?? requestedModel }
}
