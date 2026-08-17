import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type StatusInput = {
  contentItemId?: unknown
  candidateKey?: unknown
  status?: unknown
}

const allowedStatuses = new Set(['published', 'proposed', 'dismissed'])

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') return NextResponse.json({ error: 'Ton rôle ne permet pas de modifier un short.' }, { status: 403 })

  let input: StatusInput
  try {
    input = await request.json() as StatusInput
  } catch {
    return NextResponse.json({ error: 'Requête illisible.' }, { status: 400 })
  }
  const contentItemId = typeof input.contentItemId === 'string' ? input.contentItemId : null
  const candidateKey = typeof input.candidateKey === 'string' ? input.candidateKey : null
  const status = typeof input.status === 'string' && allowedStatuses.has(input.status) ? input.status : null
  if (!contentItemId || !candidateKey || !status) {
    return NextResponse.json({ error: 'Short introuvable.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'Le service n’est pas configuré.' }, { status: 503 })

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('clip_candidates')
    .update({
      status,
      published_at: status === 'published' ? now : null,
      updated_at: now,
    })
    .eq('organization_id', context.organizationId)
    .eq('content_item_id', contentItemId)
    .eq('candidate_key', candidateKey)
    .select('id, title')
    .maybeSingle()
  if (error || !updated) {
    return NextResponse.json({ error: 'Le short n’a pas pu être mis à jour.' }, { status: 500 })
  }

  if (status === 'published') {
    // Ouvre le suivi : Aneto cherchera ce short parmi les prochains contenus
    // synchronisés pour en mesurer les performances.
    await admin.from('short_publications').upsert({
      organization_id: context.organizationId,
      source_content_item_id: contentItemId,
      candidate_key: candidateKey,
      clip_title: updated.title,
      match_confidence: 'pending',
      marked_at: now,
    }, { onConflict: 'source_content_item_id,candidate_key' })

    await admin.from('memory_events').insert({
      organization_id: context.organizationId,
      event_type: `Short publié · ${updated.title}`.slice(0, 200),
      subject_type: 'content_item',
      subject_id: contentItemId,
      before_state: { status: 'proposed' },
      after_state: { status: 'published', candidate_key: candidateKey },
      impact: { measurement_status: 'awaiting_metrics' },
      source: 'human_decision',
      confidence: 1,
      observed_at: now,
    })
  }

  revalidatePath('/', 'layout')
  return NextResponse.json({
    ok: true,
    status,
    message: status === 'published' ? 'Short marqué publié — il ne sera plus proposé.' : 'Short remis dans les propositions.',
  })
}
