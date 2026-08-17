import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EDITORIAL_ANALYSIS_VERSION, enrichEditorialClips, isOpenRouterConfigured } from '@/lib/ai/openrouter'
import { buildClipCandidates } from '@/src/clips.mjs'
import { parseDurationSeconds } from '@/src/analytics.mjs'
import { logError } from '@/lib/observability'

export const maxDuration = 60

// Combien de nouveaux shorts sont proposés à chaque demande.
const NEW_SHORTS_TARGET = 5

type GeneratedCandidate = {
  id: string
  start: number
  end: number
  duration: number
  score: number
  editorialScore: number
  retention: unknown
  title: string
  hook: string
  excerpt: string
  reasons: string[]
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') return NextResponse.json({ error: 'Ton rôle ne permet pas de générer des shorts.' }, { status: 403 })
  if (!isOpenRouterConfigured()) return NextResponse.json({ error: 'La clé OpenRouter manque encore dans Vercel.' }, { status: 503 })

  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'Le service d’analyse n’est pas configuré.' }, { status: 503 })

  // 1. La dernière vidéo YouTube publiée.
  const { data: youtubeSources } = await admin
    .from('sources')
    .select('id')
    .eq('organization_id', context.organizationId)
    .eq('provider', 'youtube')
  if (!youtubeSources?.length) {
    return NextResponse.json({ error: 'Aucune chaîne YouTube connectée.' }, { status: 400 })
  }
  const { data: latestVideo } = await admin
    .from('content_items')
    .select('id, external_id, title, published_at, payload')
    .eq('organization_id', context.organizationId)
    .in('source_id', youtubeSources.map((source) => source.id))
    .eq('kind', 'video')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestVideo) {
    return NextResponse.json({ error: 'Aucune vidéo YouTube synchronisée. Lance d’abord une synchronisation.' }, { status: 400 })
  }

  // 2. Sa transcription minutée.
  const { data: transcript } = await admin
    .from('content_transcripts')
    .select('provenance, status')
    .eq('content_item_id', latestVideo.id)
    .maybeSingle()
  const segments = Array.isArray(transcript?.provenance?.timed_segments) ? transcript.provenance.timed_segments : []
  if (transcript?.status !== 'available' || !segments.length) {
    return NextResponse.json({ error: `« ${latestVideo.title} » n’a pas encore de transcription minutée. Lance une synchronisation puis réessaie.` }, { status: 400 })
  }

  // 3. Tout ce qui a déjà été proposé (publié ou non) est exclu.
  const { data: existing } = await admin
    .from('clip_candidates')
    .select('candidate_key, start_seconds, end_seconds')
    .eq('content_item_id', latestVideo.id)
  const excludeRanges = (existing ?? []).map((row) => ({ start: row.start_seconds, end: row.end_seconds }))
  const knownKeys = new Set((existing ?? []).map((row) => row.candidate_key))

  const durationSeconds = parseDurationSeconds({ payload: latestVideo.payload }) as number
  if (durationSeconds && durationSeconds < 180) {
    return NextResponse.json({ error: `« ${latestVideo.title} » dure moins de 3 minutes : c'est déjà un format court, il n'y a rien à en extraire.` }, { status: 400 })
  }

  const generated = buildClipCandidates(segments, {
    videoId: latestVideo.external_id,
    limit: NEW_SHORTS_TARGET,
    retentionPoints: Array.isArray(transcript.provenance?.retention_points) ? transcript.provenance.retention_points : [],
    durationSeconds,
    excludeRanges,
  }) as GeneratedCandidate[]
  const fresh = generated.filter((candidate) => !knownKeys.has(candidate.id))
  if (!fresh.length) {
    return NextResponse.json({ ok: true, created: 0, message: `Tous les passages exploitables de « ${latestVideo.title} » ont déjà été proposés.` })
  }

  // 4. Persistance des nouveaux candidats.
  const now = new Date().toISOString()
  const { error: insertError } = await admin.from('clip_candidates').insert(fresh.map((candidate) => ({
    organization_id: context.organizationId,
    content_item_id: latestVideo.id,
    candidate_key: candidate.id,
    start_seconds: candidate.start,
    end_seconds: candidate.end,
    duration_seconds: candidate.duration,
    score: candidate.score,
    editorial_score: candidate.editorialScore,
    retention: candidate.retention ?? null,
    title: candidate.title,
    hook: candidate.hook,
    excerpt: candidate.excerpt,
    reasons: candidate.reasons,
    updated_at: now,
  })))
  if (insertError) {
    return NextResponse.json({ error: 'Les nouveaux extraits n’ont pas pu être enregistrés.' }, { status: 500 })
  }

  // 5. Kits de publication immédiats pour ces nouveaux extraits.
  const payload = latestVideo.payload && typeof latestVideo.payload === 'object' ? latestVideo.payload as Record<string, unknown> : {}
  try {
    const result = await enrichEditorialClips([{
      contentItemId: latestVideo.id,
      title: latestVideo.title,
      publishedAt: latestVideo.published_at,
      views: Number(payload.viewCount) || 0,
      likes: Number(payload.likeCount) || 0,
      comments: Number(payload.commentCount) || 0,
      tags: Array.isArray(payload.tags) ? payload.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
      candidates: fresh.map((candidate) => ({
        id: candidate.id,
        start: candidate.start,
        end: candidate.end,
        score: candidate.score,
        excerpt: candidate.excerpt,
        reasons: candidate.reasons,
      })),
    }])
    if (result.analyses.length) {
      const { error: analysisError } = await admin.from('ai_analyses').insert(result.analyses.map((analysis) => ({
        organization_id: context.organizationId,
        content_item_id: analysis.contentItemId,
        kind: 'editorial_clips',
        version: EDITORIAL_ANALYSIS_VERSION,
        model: analysis.model,
        clips: analysis.clips,
        market_study: analysis.marketStudy,
      })))
      if (analysisError) throw analysisError
    }
    revalidatePath('/', 'layout')
    const kits = result.analyses.reduce((sum, analysis) => sum + analysis.clips.length, 0)
    return NextResponse.json({
      ok: true,
      created: fresh.length,
      kits,
      message: `${fresh.length} nouveau${fresh.length > 1 ? 'x' : ''} short${fresh.length > 1 ? 's' : ''} proposé${fresh.length > 1 ? 's' : ''} sur « ${latestVideo.title} »${kits ? ` · ${kits} kit${kits > 1 ? 's' : ''} de publication prêt${kits > 1 ? 's' : ''}` : ''}.`,
    })
  } catch (error) {
    // Les candidats sont enregistrés ; le kit IA pourra être relancé depuis la page.
    logError('more_shorts_kit_failed', error, { organizationId: context.organizationId, contentItemId: latestVideo.id })
    revalidatePath('/', 'layout')
    const message = error instanceof Error ? error.message.slice(0, 160) : 'openrouter_error'
    return NextResponse.json({
      ok: true,
      created: fresh.length,
      kits: 0,
      message: `${fresh.length} nouveau${fresh.length > 1 ? 'x' : ''} short${fresh.length > 1 ? 's' : ''} proposé${fresh.length > 1 ? 's' : ''}, mais l’IA n’a pas terminé les kits (${message}). Relance « Lancer les analyses ».`,
    })
  }
}
