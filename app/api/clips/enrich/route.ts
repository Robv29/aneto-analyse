import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { buildClipCandidates } from '@/src/clips.mjs'
import { parseDurationSeconds } from '@/src/analytics.mjs'
import { enrichEditorialClips, isOpenRouterConfigured } from '@/lib/ai/openrouter'

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
    admin.from('content_items').select('id, external_id, title, payload').eq('organization_id', context.organizationId).eq('kind', 'video'),
  ])
  if (transcriptError || contentError) return NextResponse.json({ error: 'Les transcriptions ne peuvent pas être chargées.' }, { status: 500 })

  const contentById = new Map((contents ?? []).map((content) => [content.id, content]))
  const eligible = (transcripts ?? []).filter((transcript) => {
    const provenance = transcript.provenance ?? {}
    return Array.isArray(provenance.timed_segments) && provenance.timed_segments.length && !Array.isArray(provenance.ai_clips)
  }).slice(0, 3)
  if (!eligible.length) return NextResponse.json({ ok: true, enriched: 0, message: 'Tous les extraits disponibles ont déjà été enrichis.' })

  let enriched = 0
  let lastError = ''
  for (const transcript of eligible) {
    const content = contentById.get(transcript.content_item_id)
    if (!content) continue
    const provenance = transcript.provenance ?? {}
    const candidates = buildClipCandidates(provenance.timed_segments, {
      videoId: content.external_id,
      limit: 8,
      retentionPoints: Array.isArray(provenance.retention_points) ? provenance.retention_points : [],
      durationSeconds: parseDurationSeconds({ payload: content.payload }),
    })
    if (!candidates.length) continue
    try {
      const result = await enrichEditorialClips(content.title, candidates)
      const { error: updateError } = await admin.from('content_transcripts').update({
        provenance: {
          ...provenance,
          ai_clips: result.clips,
          ai_model: result.model,
          ai_enriched_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', transcript.id).eq('organization_id', context.organizationId)
      if (updateError) throw updateError
      enriched += 1
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 180) : 'openrouter_error'
    }
  }

  if (!enriched && lastError) return NextResponse.json({ error: `OpenRouter n’a pas terminé l’analyse : ${lastError}` }, { status: 502 })
  revalidatePath('/clips')
  revalidatePath('/intelligence')
  return NextResponse.json({
    ok: true,
    enriched,
    message: `${enriched} vidéo${enriched>1?'s':''} enrichie${enriched>1?'s':''} par OpenRouter. Les meilleurs titres et hooks sont prêts.`,
  })
}
