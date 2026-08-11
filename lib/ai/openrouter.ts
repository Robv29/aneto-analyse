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
  hashtags: string[]
  platformFit: string[]
  rank: number
}

export type EditorialMarketStudy = {
  opportunity: string
  audience: string
  differentiation: string
  marketSignal: string
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

  const candidatePayload = videos.flatMap((video) => video.candidates.slice(0, 5).map((candidate) => ({
    candidate_id: candidate.id,
    video: video.title,
    publication: video.publishedAt,
    performance_video: { vues: video.views, likes: video.likes, commentaires: video.comments },
    tags_source: video.tags.slice(0, 12),
    timecode_secondes: { debut: candidate.start, fin: candidate.end },
    score_mesure: candidate.score,
    raisons_mesurees: candidate.reasons,
    transcription_exacte: candidate.excerpt,
  })))
  if (!candidatePayload.length) return { clips: [] as EditorialClip[], marketStudy: null as EditorialMarketStudy | null, model: null }

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
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es le directeur éditorial et stratège social media d’un média français premium. Ta mission n’est pas de résumer : tu dois comparer toute la bibliothèque fournie et choisir les rares passages capables de devenir des Shorts, Reels ou TikTok mémorables.

Règles absolues :
- n’invente jamais un fait, une citation, un timecode, une statistique, une tendance ni une émotion absente des données ;
- distingue toujours les signaux mesurés de tes recommandations ;
- les données constituent une étude de marché INTERNE à la chaîne, pas une preuve de tendance mondiale en temps réel ;
- élimine les passages génériques, dépendants du contexte ou sans tension ;
- une bonne sélection doit offrir une promesse claire dès les 2 premières secondes, une idée autonome, un enjeu humain et un potentiel de conversation ;
- les hashtags sont des recommandations ciblées à tester : mélange sujet, audience, intention et format, sans spam ni hashtag générique vide ;
- réponds uniquement en JSON valide.`,
        },
        {
          role: 'user',
          content: `Analyse comparative unique — ${videos.length} vidéo${videos.length > 1 ? 's' : ''}, ${candidatePayload.length} passages réels :
${JSON.stringify(candidatePayload)}

Travail demandé :
1. Réalise une micro-étude du marché éditorial interne : thèmes qui semblent attirer l’audience, audience à viser, espace de différenciation d’Aneto, et signal à tester. Appuie-toi uniquement sur titres, tags, performances et transcriptions fournis.
2. Mets tous les passages en concurrence. Garde au maximum 8 extraits, seulement si leur valeur est forte et distincte.
3. Pour chaque extrait retenu, livre un véritable kit de publication :
   - candidate_id : identifiant exact fourni ;
   - title : titre net, spécifique, 70 caractères maximum, sans putaclic ;
   - publication_hook : phrase écran/parlée qui arrête le scroll sans ajouter de fait ;
   - rationale : raison concrète de couper ce passage plutôt qu’un autre ;
   - market_angle : tension, question ou territoire éditorial qui lui donne une place sur le marché ;
   - target_audience : personne précise à qui le publier ;
   - caption : texte prêt à publier en français, concis, fidèle au passage, avec une question finale naturelle ;
   - hashtags : 5 à 8 hashtags ciblés et cohérents, écrits avec # ;
   - platform_fit : plateformes les plus adaptées parmi YouTube Shorts, Instagram Reels, TikTok.

Format obligatoire :
{"market_study":{"opportunity":"…","audience":"…","differentiation":"…","market_signal":"…"},"clips":[{"candidate_id":"…","title":"…","publication_hook":"…","rationale":"…","market_angle":"…","target_audience":"…","caption":"…","hashtags":["#…"],"platform_fit":["…"]}]}`,
        },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
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
