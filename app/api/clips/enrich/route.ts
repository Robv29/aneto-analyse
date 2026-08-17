import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EDITORIAL_ANALYSIS_VERSION, enrichEditorialClips, isOpenRouterConfigured } from '@/lib/ai/openrouter'

export const maxDuration = 60

const VIDEOS_PER_BATCH = 4
const CANDIDATES_PER_VIDEO = 4

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

  const [{ data: candidates, error: candidateError }, { data: analyses, error: analysisError }] = await Promise.all([
    admin.from('clip_candidates')
      .select('content_item_id, candidate_key, start_seconds, end_seconds, score, excerpt, reasons')
      .eq('organization_id', context.organizationId)
      .order('score', { ascending: false }),
    admin.from('ai_analyses')
      .select('content_item_id')
      .eq('organization_id', context.organizationId)
      .eq('kind', 'editorial_clips')
      .eq('version', EDITORIAL_ANALYSIS_VERSION),
  ])
  if (candidateError || analysisError) {
    return NextResponse.json({ error: 'Les extraits candidats ne peuvent pas être chargés.' }, { status: 500 })
  }

  const alreadyAnalyzed = new Set((analyses ?? []).map((analysis) => analysis.content_item_id))
  const byContent = new Map<string, typeof candidates>()
  for (const candidate of candidates ?? []) {
    if (alreadyAnalyzed.has(candidate.content_item_id)) continue
    const list = byContent.get(candidate.content_item_id) ?? []
    if (list.length < CANDIDATES_PER_VIDEO) list.push(candidate)
    byContent.set(candidate.content_item_id, list)
  }
  const eligibleContentIds = [...byContent.keys()].slice(0, VIDEOS_PER_BATCH)
  if (!eligibleContentIds.length) {
    return NextResponse.json({ ok: true, enriched: 0, message: 'Tous les extraits disponibles ont déjà été analysés.' })
  }

  const { data: contents, error: contentError } = await admin
    .from('content_items')
    .select('id, title, published_at, payload')
    .eq('organization_id', context.organizationId)
    .in('id', eligibleContentIds)
  if (contentError) return NextResponse.json({ error: 'Les contenus à analyser ne peuvent pas être chargés.' }, { status: 500 })
  const contentById = new Map((contents ?? []).map((content) => [content.id, content]))

  const videos = eligibleContentIds.flatMap((contentItemId) => {
    const content = contentById.get(contentItemId)
    const list = byContent.get(contentItemId) ?? []
    if (!content || !list.length) return []
    const payload = content.payload && typeof content.payload === 'object' ? content.payload as Record<string, unknown> : {}
    return [{
      contentItemId,
      title: content.title,
      publishedAt: content.published_at,
      views: Number(payload.viewCount) || 0,
      likes: Number(payload.likeCount) || 0,
      comments: Number(payload.commentCount) || 0,
      tags: Array.isArray(payload.tags) ? payload.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
      candidates: list.map((candidate) => ({
        id: candidate.candidate_key,
        start: candidate.start_seconds,
        end: candidate.end_seconds,
        score: candidate.score,
        excerpt: candidate.excerpt,
        reasons: candidate.reasons ?? [],
      })),
    }]
  })
  if (!videos.length) return NextResponse.json({ ok: true, enriched: 0, message: 'Aucun passage minuté ne peut encore être analysé.' })

  try {
    const result = await enrichEditorialClips(videos)
    if (result.analyses.length) {
      const { error: insertError } = await admin.from('ai_analyses').upsert(result.analyses.map((analysis) => ({
        organization_id: context.organizationId,
        content_item_id: analysis.contentItemId,
        kind: 'editorial_clips',
        version: EDITORIAL_ANALYSIS_VERSION,
        model: analysis.model,
        clips: analysis.clips,
        market_study: analysis.marketStudy,
      })), { onConflict: 'content_item_id,kind,version' })
      if (insertError) throw insertError
    }
    const finalists = result.analyses.reduce((sum, analysis) => sum + analysis.clips.length, 0)
    revalidatePath('/', 'layout')
    return NextResponse.json({
      ok: true,
      enriched: result.analyses.length,
      requestCount: result.requestCount,
      succeeded: result.succeeded,
      failed: result.failed,
      message: result.failed
        ? `${result.succeeded}/${result.requestCount} analyses terminées · ${finalists} finaliste${finalists > 1 ? 's' : ''} retenu${finalists > 1 ? 's' : ''}. Les vidéos en échec pourront être relancées.`
        : `${result.requestCount} analyse${result.requestCount > 1 ? 's' : ''} terminée${result.requestCount > 1 ? 's' : ''} · ${finalists} finaliste${finalists > 1 ? 's' : ''} retenu${finalists > 1 ? 's' : ''}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : 'openrouter_error'
    return NextResponse.json({ error: `OpenRouter n’a pas terminé l’analyse : ${message}` }, { status: 502 })
  }
}
