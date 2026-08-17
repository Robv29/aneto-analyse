import 'server-only'
import { cache } from 'react'
import type { ActiveWorkspace } from '@/lib/data/session'
import { EDITORIAL_ANALYSIS_VERSION } from '@/lib/ai/openrouter'

export type WorkspaceSource = {
  id: string
  provider: string
  state: string
  lastSyncedAt: string | null
  oauthScopes: string[]
}

export type LibraryItem = {
  id: string
  kind: string
  provider: string
  externalId: string
  title: string
  publishedAt: string | null
  payload: Record<string, unknown>
  transcript: null | {
    status: string
    language: string | null
    wordCount: number
    keywords: string[]
  }
  hasClipCandidates: boolean
}

export type WorkspaceDecision = {
  id: string
  title: string
  rationale: string
  status: string
  confidence: number | null
  createdAt: string
}

export type WorkspaceMemoryEvent = {
  id: string
  eventType: string
  source: string
  confidence: number | null
  observedAt: string
  impact: Record<string, unknown>
}

export type ClipScorecard = { hook: number; autonomy: number; tension: number; conversation: number; fidelity: number }

export type BoardClip = {
  id: string
  contentItemId: string
  contentTitle: string
  externalId: string
  start: number
  end: number
  duration: number
  score: number
  editorialScore: number
  retention: null | { audienceWatchRatio: number; relativeRetentionPerformance: number }
  title: string
  hook: string
  publicationHook: string
  excerpt: string
  reasons: string[]
  aiEnhanced: boolean
  rationale: string | null
  marketAngle: string | null
  caption: string | null
  targetAudience: string | null
  whyNow: string | null
  risk: string | null
  testHypothesis: string | null
  scorecard: ClipScorecard | null
  hashtags: string[]
  platformFit: string[]
}

export type ClipBoard = {
  clips: BoardClip[]
  aiClipCount: number
  publishedCount: number
  publishedThisWeek: number
  marketStudy: null | {
    opportunity: string
    audience: string
    differentiation: string
    marketSignal: string
    limits: string
    nextTest: string
  }
  aiModel: string | null
}

export const getSources = cache(async (workspace: ActiveWorkspace): Promise<WorkspaceSource[]> => {
  const { data, error } = await workspace.supabase
    .from('sources')
    .select('id, provider, state, last_synced_at, oauth_scopes')
    .eq('organization_id', workspace.organization.id)
    .order('created_at')
  if (error) throw new Error(`Sources inaccessibles: ${error.message}`)
  return (data ?? []).map((source) => ({
    id: source.id,
    provider: source.provider,
    state: source.state,
    lastSyncedAt: source.last_synced_at,
    oauthScopes: source.oauth_scopes ?? [],
  }))
})

export const getLibrary = cache(async (workspace: ActiveWorkspace, limit = 120): Promise<LibraryItem[]> => {
  const [contentResult, sourcesResult, transcriptsResult, candidatesResult] = await Promise.all([
    workspace.supabase
      .from('content_items')
      .select('id, source_id, kind, external_id, title, published_at, payload')
      .eq('organization_id', workspace.organization.id)
      .order('published_at', { ascending: false })
      .limit(limit),
    workspace.supabase
      .from('sources')
      .select('id, provider')
      .eq('organization_id', workspace.organization.id),
    workspace.supabase
      .from('content_transcripts')
      .select('content_item_id, status, language, word_count, keywords')
      .eq('organization_id', workspace.organization.id),
    workspace.supabase
      .from('clip_candidates')
      .select('content_item_id')
      .eq('organization_id', workspace.organization.id),
  ])
  const firstError = [contentResult.error, sourcesResult.error, transcriptsResult.error, candidatesResult.error].find(Boolean)
  if (firstError) throw new Error(`Bibliothèque inaccessible: ${firstError.message}`)

  const providerBySource = new Map((sourcesResult.data ?? []).map((source) => [source.id, source.provider]))
  const transcriptByContent = new Map((transcriptsResult.data ?? []).map((transcript) => [transcript.content_item_id, transcript]))
  const contentsWithClips = new Set((candidatesResult.data ?? []).map((candidate) => candidate.content_item_id))

  return (contentResult.data ?? []).map((item) => {
    const transcript = transcriptByContent.get(item.id)
    return {
      id: item.id,
      kind: item.kind,
      provider: providerBySource.get(item.source_id) ?? item.kind,
      externalId: item.external_id,
      title: item.title,
      publishedAt: item.published_at,
      payload: (item.payload ?? {}) as Record<string, unknown>,
      transcript: transcript ? {
        status: transcript.status,
        language: transcript.language,
        wordCount: transcript.word_count ?? 0,
        keywords: transcript.keywords ?? [],
      } : null,
      hasClipCandidates: contentsWithClips.has(item.id),
    }
  })
})

export const getDecisions = cache(async (workspace: ActiveWorkspace, limit = 12): Promise<WorkspaceDecision[]> => {
  const { data, error } = await workspace.supabase
    .from('decisions')
    .select('id, title, rationale, status, confidence, created_at')
    .eq('organization_id', workspace.organization.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Décisions inaccessibles: ${error.message}`)
  return (data ?? []).map((decision) => ({
    id: decision.id,
    title: decision.title,
    rationale: decision.rationale,
    status: decision.status,
    confidence: decision.confidence === null ? null : Number(decision.confidence),
    createdAt: decision.created_at,
  }))
})

export const getMemoryEvents = cache(async (workspace: ActiveWorkspace, limit = 30): Promise<WorkspaceMemoryEvent[]> => {
  const { data, error } = await workspace.supabase
    .from('memory_events')
    .select('id, event_type, source, confidence, observed_at, impact')
    .eq('organization_id', workspace.organization.id)
    .order('observed_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Mémoire inaccessible: ${error.message}`)
  return (data ?? []).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    source: event.source,
    confidence: event.confidence === null ? null : Number(event.confidence),
    observedAt: event.observed_at,
    impact: (event.impact ?? {}) as Record<string, unknown>,
  }))
})

type StoredAiClip = {
  candidateId?: string
  title?: string
  publicationHook?: string
  rationale?: string
  marketAngle?: string
  caption?: string
  targetAudience?: string
  whyNow?: string
  risk?: string
  testHypothesis?: string
  scorecard?: Partial<ClipScorecard>
  hashtags?: string[]
  platformFit?: string[]
}

// Les extraits sont matérialisés en base à la synchronisation ; ici on ne fait
// que lire les propositions et fusionner les kits IA (tous lots confondus,
// le plus récent gagne par candidate_key). Aucun calcul.
export const getClipBoard = cache(async (workspace: ActiveWorkspace, limit = 60): Promise<ClipBoard> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [candidatesResult, analysesResult, publishedResult, publishedWeekResult] = await Promise.all([
    workspace.supabase
      .from('clip_candidates')
      .select('content_item_id, candidate_key, start_seconds, end_seconds, duration_seconds, score, editorial_score, retention, title, hook, excerpt, reasons')
      .eq('organization_id', workspace.organization.id)
      .eq('status', 'proposed')
      .order('score', { ascending: false })
      .limit(limit),
    workspace.supabase
      .from('ai_analyses')
      .select('content_item_id, version, model, clips, market_study, created_at')
      .eq('organization_id', workspace.organization.id)
      .eq('kind', 'editorial_clips')
      .eq('version', EDITORIAL_ANALYSIS_VERSION)
      .order('created_at', { ascending: false }),
    workspace.supabase
      .from('clip_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', workspace.organization.id)
      .eq('status', 'published'),
    workspace.supabase
      .from('clip_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', workspace.organization.id)
      .eq('status', 'published')
      .gte('published_at', weekAgo),
  ])
  const firstError = [candidatesResult.error, analysesResult.error].find(Boolean)
  if (firstError) throw new Error(`Extraits inaccessibles: ${firstError.message}`)

  const publishedCount = publishedResult.count ?? 0
  const publishedThisWeek = publishedWeekResult.count ?? 0
  const candidates = candidatesResult.data ?? []
  if (!candidates.length) return { clips: [], aiClipCount: 0, publishedCount, publishedThisWeek, marketStudy: null, aiModel: null }

  const kitByCandidateKey = new Map<string, StoredAiClip>()
  const latestAnalysisByContent = new Map<string, { model: string; market_study: ClipBoard['marketStudy'] }>()
  for (const analysis of analysesResult.data ?? []) {
    if (!latestAnalysisByContent.has(analysis.content_item_id)) {
      latestAnalysisByContent.set(analysis.content_item_id, {
        model: analysis.model,
        market_study: analysis.market_study ?? null,
      })
    }
    for (const clip of Array.isArray(analysis.clips) ? analysis.clips as StoredAiClip[] : []) {
      if (clip.candidateId && !kitByCandidateKey.has(clip.candidateId)) kitByCandidateKey.set(clip.candidateId, clip)
    }
  }

  const contentIds = [...new Set(candidates.map((candidate) => candidate.content_item_id))]
  const { data: contents, error: contentError } = await workspace.supabase
    .from('content_items')
    .select('id, title, external_id')
    .eq('organization_id', workspace.organization.id)
    .in('id', contentIds)
  if (contentError) throw new Error(`Contenus des extraits inaccessibles: ${contentError.message}`)
  const contentById = new Map((contents ?? []).map((content) => [content.id, content]))

  const clips: BoardClip[] = candidates.flatMap((candidate) => {
    const content = contentById.get(candidate.content_item_id)
    if (!content) return []
    const aiClip = kitByCandidateKey.get(candidate.candidate_key) ?? null
    const scorecard = aiClip?.scorecard && Object.values(aiClip.scorecard).every((score) => Number.isFinite(Number(score))) ? {
      hook: Number(aiClip.scorecard.hook),
      autonomy: Number(aiClip.scorecard.autonomy),
      tension: Number(aiClip.scorecard.tension),
      conversation: Number(aiClip.scorecard.conversation),
      fidelity: Number(aiClip.scorecard.fidelity),
    } : null
    return [{
      id: candidate.candidate_key,
      contentItemId: candidate.content_item_id,
      contentTitle: content.title,
      externalId: content.external_id,
      start: candidate.start_seconds,
      end: candidate.end_seconds,
      duration: candidate.duration_seconds,
      score: candidate.score,
      editorialScore: candidate.editorial_score,
      retention: candidate.retention as BoardClip['retention'],
      title: aiClip?.title || candidate.title,
      hook: candidate.hook,
      publicationHook: aiClip?.publicationHook || candidate.hook,
      excerpt: candidate.excerpt,
      reasons: candidate.reasons ?? [],
      aiEnhanced: Boolean(aiClip),
      rationale: aiClip?.rationale || null,
      marketAngle: aiClip?.marketAngle || null,
      caption: aiClip?.caption || null,
      targetAudience: aiClip?.targetAudience || null,
      whyNow: aiClip?.whyNow || null,
      risk: aiClip?.risk || null,
      testHypothesis: aiClip?.testHypothesis || null,
      scorecard,
      hashtags: Array.isArray(aiClip?.hashtags) ? aiClip.hashtags : [],
      platformFit: Array.isArray(aiClip?.platformFit) ? aiClip.platformFit : [],
    }]
  })

  const topEnriched = clips.find((clip) => clip.aiEnhanced)
  const topAnalysis = topEnriched ? latestAnalysisByContent.get(topEnriched.contentItemId) : [...latestAnalysisByContent.values()][0]
  return {
    clips,
    aiClipCount: clips.filter((clip) => clip.aiEnhanced).length,
    publishedCount,
    publishedThisWeek,
    marketStudy: topAnalysis?.market_study ?? null,
    aiModel: topAnalysis?.model ?? null,
  }
})

// Nombre d'extraits proposés qui n'ont pas encore leur kit de publication.
export const getPendingAnalysisCount = cache(async (workspace: ActiveWorkspace): Promise<number> => {
  const [{ data: candidates }, { data: analyses }] = await Promise.all([
    workspace.supabase
      .from('clip_candidates')
      .select('candidate_key')
      .eq('organization_id', workspace.organization.id)
      .eq('status', 'proposed'),
    workspace.supabase
      .from('ai_analyses')
      .select('clips')
      .eq('organization_id', workspace.organization.id)
      .eq('kind', 'editorial_clips')
      .eq('version', EDITORIAL_ANALYSIS_VERSION),
  ])
  const kitted = new Set<string>()
  for (const analysis of analyses ?? []) {
    for (const clip of Array.isArray(analysis.clips) ? analysis.clips as StoredAiClip[] : []) {
      if (clip.candidateId) kitted.add(clip.candidateId)
    }
  }
  return (candidates ?? []).filter((candidate) => !kitted.has(candidate.candidate_key)).length
})

export type StoredInsights = {
  summary: string
  insights: Array<{ finding: string; evidence: string; action: string }>
  model: string
  createdAt: string
} | null

// Dernière lecture « ce qui marche » produite par l'IA (toutes plateformes).
export const getPatternInsights = cache(async (workspace: ActiveWorkspace): Promise<StoredInsights> => {
  const { data } = await workspace.supabase
    .from('ai_analyses')
    .select('payload, model, created_at')
    .eq('organization_id', workspace.organization.id)
    .eq('kind', 'performance_insights')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const payload = data?.payload as { summary?: unknown; insights?: unknown } | undefined
  if (!data || typeof payload?.summary !== 'string' || !Array.isArray(payload.insights)) return null
  return {
    summary: payload.summary,
    insights: payload.insights as Array<{ finding: string; evidence: string; action: string }>,
    model: data.model,
    createdAt: data.created_at,
  }
})
