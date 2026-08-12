import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { buildClipCandidates } from '@/src/clips.mjs'
import { parseDurationSeconds } from '@/src/analytics.mjs'
import { enrichEditorialClips, isOpenRouterConfigured } from '@/lib/ai/openrouter'

export const maxDuration = 180

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') return NextResponse.json({ error: 'Ton rôle ne permet pas de lancer cette analyse.' }, { status: 403 })
  if (!isOpenRouterConfigured()) return NextResponse.json({ error: 'La clé OpenRouter manque encore dans Vercel.' }, { status: 503 })

  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'Le service d’analyse n’est pas configuré.' }, { status: 503 })

  const [{ data: transcripts, error: transcriptError }, { data: contents, error: contentError }] = await Promise.all([
    admin.from('content_transcripts').select('id, content_item_id, provenance').eq('organization_id', context.organizationId).eq('status', 'available'),
    admin.from('content_items').select('id, external_id, title, published_at, payload').eq('organization_id', context.organizationId).eq('kind', 'video'),
  ])
  if (transcriptError || contentError) return NextResponse.json({ error: 'Les transcriptions ne peuvent pas être chargées.' }, { status: 500 })

  const contentById = new Map((contents ?? []).map((content) => [content.id, content]))
  const eligible = (transcripts ?? []).filter((transcript) => {
    const provenance = transcript.provenance ?? {}
    return Array.isArray(provenance.timed_segments) && provenance.timed_segments.length && provenance.ai_editorial_version !== 4
  }).slice(0, 4)
  if (!eligible.length) return NextResponse.json({ ok: true, enriched: 0, message: 'Tous les extraits disponibles ont déjà été enrichis.' })

  const batches = eligible.flatMap((transcript) => {
    const content = contentById.get(transcript.content_item_id)
    if (!content) return []
    const provenance = transcript.provenance ?? {}
    const candidates = buildClipCandidates(provenance.timed_segments, {
      videoId: content.external_id,
      limit: 4,
      retentionPoints: Array.isArray(provenance.retention_points) ? provenance.retention_points : [],
      durationSeconds: parseDurationSeconds({ payload: content.payload }),
    })
    if (!candidates.length) return []
    const payload = content.payload && typeof content.payload === 'object' ? content.payload : {}
    return [{
      transcript,
      provenance,
      video: {
        contentItemId: content.id,
        title: content.title,
        publishedAt: content.published_at,
        views: Number(payload.viewCount) || 0,
        likes: Number(payload.likeCount) || 0,
        comments: Number(payload.commentCount) || 0,
        tags: Array.isArray(payload.tags) ? payload.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
        candidates,
      },
    }]
  })
  if (!batches.length) return NextResponse.json({ ok: true, enriched: 0, message: 'Aucun passage minuté ne peut encore être analysé.' })

  try {
    const result = await enrichEditorialClips(batches.map((batch) => batch.video))
    const selectedByCandidate = new Map(result.clips.map((clip) => [clip.candidateId, clip]))
    const analyzedVideoIds = new Set(result.analyzedVideoIds)
    const enrichedAt = new Date().toISOString()
    const updates = await Promise.all(batches.filter(({ video }) => analyzedVideoIds.has(video.contentItemId)).map(async ({ transcript, provenance, video }) => {
      const clips = video.candidates.flatMap((candidate) => {
        const selected = selectedByCandidate.get(candidate.id)
        return selected ? [selected] : []
      })
      const { error: updateError } = await admin.from('content_transcripts').update({
        provenance: {
          ...provenance,
          ai_clips: clips,
          ai_market_study: result.marketStudy,
          ai_editorial_version: 4,
          ai_model: result.model,
          ai_enriched_at: enrichedAt,
        },
        updated_at: enrichedAt,
      }).eq('id', transcript.id).eq('organization_id', context.organizationId)
      if (updateError) throw updateError
      return 1
    }))
    const enriched = updates.reduce((sum, count) => sum + count, 0)
    revalidatePath('/clips')
    revalidatePath('/intelligence')
    return NextResponse.json({
      ok: true,
      enriched,
      requestCount: result.requestCount,
      succeeded: result.succeeded,
      failed: result.failed,
      message: result.failed
        ? `${result.succeeded}/${result.requestCount} analyses terminées · ${result.clips.length} finaliste${result.clips.length > 1 ? 's' : ''} retenu${result.clips.length > 1 ? 's' : ''}. Les vidéos expirées pourront être relancées.`
        : `${result.requestCount} analyse${result.requestCount > 1 ? 's' : ''} courte${result.requestCount > 1 ? 's' : ''} terminée${result.requestCount > 1 ? 's' : ''} · ${result.clips.length} finaliste${result.clips.length > 1 ? 's' : ''} retenu${result.clips.length > 1 ? 's' : ''}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : 'openrouter_error'
    return NextResponse.json({ error: `OpenRouter n’a pas terminé l’analyse : ${message}` }, { status: 502 })
  }
}
