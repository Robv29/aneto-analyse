import { getConnectorConfiguration } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildClipCandidates } from '@/src/clips.mjs'
import { parseDurationSeconds } from '@/src/analytics.mjs'

export type ClipCandidate = {
  id: string
  start: number
  end: number
  duration: number
  score: number
  editorialScore: number
  retention: null | { audienceWatchRatio: number; relativeRetentionPerformance: number }
  title: string
  hook: string
  publicationHook: string
  rationale: string | null
  marketAngle: string | null
  caption: string | null
  targetAudience: string | null
  hashtags: string[]
  platformFit: string[]
  aiEnhanced: boolean
  excerpt: string
  reasons: string[]
}

export type WorkspaceSnapshot = {
  mode: 'demo' | 'live'
  viewer: null | { id: string; email: string | null; displayName: string | null }
  organization: null | { id: string; name: string; slug: string; role: string }
  sources: Array<{
    id: string
    provider: string
    state: string
    lastSyncedAt: string | null
    oauthScopes: string[]
  }>
  contentItems: Array<{
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
      timed: boolean
      aiEnhanced: boolean
      aiModel: string | null
      marketStudy: null | {
        opportunity: string
        audience: string
        differentiation: string
        marketSignal: string
      }
      clips: ClipCandidate[]
    }
  }>
  decisions: Array<{
    id: string
    title: string
    rationale: string
    status: string
    confidence: number | null
    createdAt: string
  }>
  memoryEvents: Array<{
    id: string
    eventType: string
    source: string
    confidence: number | null
    observedAt: string
    impact: Record<string, unknown>
  }>
  connectors: Array<{ key: string; label: string; configured: boolean }>
}

const emptySnapshot = (): WorkspaceSnapshot => ({
  mode: 'demo',
  viewer: null,
  organization: null,
  sources: [],
  contentItems: [],
  decisions: [],
  memoryEvents: [],
  connectors: getConnectorConfiguration(),
})

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return emptySnapshot()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  // Expired or legacy browser cookies are an unauthenticated state, not an
  // application incident. The login flow will replace them with a valid session.
  if (authError || !authData.user) return { ...emptySnapshot(), mode: 'live' }

  const user = authData.user
  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('organization_id, role').eq('user_id', user.id).limit(1).maybeSingle(),
  ])

  if (profileError) throw new Error(`Profil inaccessible: ${profileError.message}`)
  if (membershipError) throw new Error(`Organisation inaccessible: ${membershipError.message}`)

  const base: WorkspaceSnapshot = {
    ...emptySnapshot(),
    mode: 'live',
    viewer: {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? null,
    },
  }

  if (!membership) return base

  const organizationId = membership.organization_id
  const [organizationResult, sourcesResult, contentResult, decisionsResult, memoryResult, transcriptsResult] = await Promise.all([
    supabase.from('organizations').select('id, name, slug').eq('id', organizationId).single(),
    supabase.from('sources').select('id, provider, state, last_synced_at, oauth_scopes').eq('organization_id', organizationId).order('created_at'),
    supabase.from('content_items').select('id, source_id, kind, external_id, title, published_at, payload').eq('organization_id', organizationId).order('published_at', { ascending: false }).limit(500),
    supabase.from('decisions').select('id, title, rationale, status, confidence, created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(12),
    supabase.from('memory_events').select('id, event_type, source, confidence, observed_at, impact').eq('organization_id', organizationId).order('observed_at', { ascending: false }).limit(30),
    supabase.from('content_transcripts').select('content_item_id, status, language, word_count, keywords, provenance').eq('organization_id', organizationId),
  ])

  const firstError = [organizationResult.error, sourcesResult.error, contentResult.error, decisionsResult.error, memoryResult.error, transcriptsResult.error].find(Boolean)
  if (firstError) throw new Error(`Chargement de l’espace impossible: ${firstError.message}`)
  const organization = organizationResult.data
  if (!organization) throw new Error('Organisation introuvable malgré une adhésion active.')

  return {
    ...base,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: membership.role,
    },
    sources: (sourcesResult.data ?? []).map((source) => ({
      id: source.id,
      provider: source.provider,
      state: source.state,
      lastSyncedAt: source.last_synced_at,
      oauthScopes: source.oauth_scopes ?? [],
    })),
    contentItems: (contentResult.data ?? []).map((item) => ({
      id: item.id,
      kind: item.kind,
      provider: sourcesResult.data?.find((source) => source.id === item.source_id)?.provider ?? item.kind,
      externalId: item.external_id,
      title: item.title,
      publishedAt: item.published_at,
      payload: (item.payload ?? {}) as Record<string, unknown>,
      transcript: (() => {
        const transcript = transcriptsResult.data?.find((entry) => entry.content_item_id === item.id)
        const segments = Array.isArray(transcript?.provenance?.timed_segments) ? transcript.provenance.timed_segments : []
        const retentionPoints = Array.isArray(transcript?.provenance?.retention_points) ? transcript.provenance.retention_points : []
        const aiClips: Array<{ candidateId?: string; title?: string; publicationHook?: string; rationale?: string; marketAngle?: string; caption?: string; targetAudience?: string; hashtags?: string[]; platformFit?: string[] }> = Array.isArray(transcript?.provenance?.ai_clips) ? transcript.provenance.ai_clips : []
        const measuredClips = buildClipCandidates(segments, {
          videoId: item.external_id,
          limit: 8,
          retentionPoints,
          durationSeconds: parseDurationSeconds({ payload: item.payload }),
        })
        const measuredById = new Map(measuredClips.map((clip) => [clip.id, clip]))
        const enrichedClips = aiClips.flatMap((aiClip) => {
          if (!aiClip.candidateId) return []
          const measured = measuredById.get(aiClip.candidateId)
          if (!measured) return []
          return [{
            ...measured,
            title: aiClip.title || measured.title,
            publicationHook: aiClip.publicationHook || measured.hook,
            rationale: aiClip.rationale || null,
            marketAngle: aiClip.marketAngle || null,
            caption: aiClip.caption || null,
            targetAudience: aiClip.targetAudience || null,
            hashtags: Array.isArray(aiClip.hashtags) ? aiClip.hashtags : [],
            platformFit: Array.isArray(aiClip.platformFit) ? aiClip.platformFit : [],
            aiEnhanced: true,
          }]
        })
        const remainingClips = measuredClips.filter((clip) => !enrichedClips.some((enriched: { id: string }) => enriched.id === clip.id)).map((clip) => ({
          ...clip,
          publicationHook: clip.hook,
          rationale: null,
          marketAngle: null,
          caption: null,
          targetAudience: null,
          hashtags: [],
          platformFit: [],
          aiEnhanced: false,
        }))
        return transcript ? {
          status: transcript.status,
          language: transcript.language,
          wordCount: transcript.word_count ?? 0,
          keywords: transcript.keywords ?? [],
          timed: segments.length > 0,
          aiEnhanced: enrichedClips.length > 0,
          aiModel: typeof transcript.provenance?.ai_model === 'string' ? transcript.provenance.ai_model : null,
          marketStudy: (() => {
            const study = transcript.provenance?.ai_market_study
            return study && typeof study === 'object'
              && typeof study.opportunity === 'string'
              && typeof study.audience === 'string'
              && typeof study.differentiation === 'string'
              && typeof study.marketSignal === 'string'
              ? study
              : null
          })(),
          clips: [...enrichedClips, ...remainingClips].slice(0, 3),
        } : null
      })(),
    })),
    decisions: (decisionsResult.data ?? []).map((decision) => ({
      id: decision.id,
      title: decision.title,
      rationale: decision.rationale,
      status: decision.status,
      confidence: decision.confidence === null ? null : Number(decision.confidence),
      createdAt: decision.created_at,
    })),
    memoryEvents: (memoryResult.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      source: event.source,
      confidence: event.confidence === null ? null : Number(event.confidence),
      observedAt: event.observed_at,
      impact: event.impact as Record<string, unknown>,
    })),
  }
}
