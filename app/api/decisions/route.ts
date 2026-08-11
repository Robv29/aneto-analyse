import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type DecisionInput = {
  title?: unknown
  rationale?: unknown
  contentItemId?: unknown
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') {
    return NextResponse.json({ error: 'Ton rôle ne permet pas de mémoriser une décision.' }, { status: 403 })
  }

  let input: DecisionInput
  try {
    input = await request.json() as DecisionInput
  } catch {
    return NextResponse.json({ error: 'Décision illisible.' }, { status: 400 })
  }

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const rationale = typeof input.rationale === 'string' ? input.rationale.trim() : ''
  const contentItemId = typeof input.contentItemId === 'string' ? input.contentItemId : null
  if (title.length < 8 || title.length > 240 || rationale.length < 16 || rationale.length > 1600) {
    return NextResponse.json({ error: 'La décision est incomplète.' }, { status: 400 })
  }

  if (contentItemId) {
    const { data: content } = await context.supabase
      .from('content_items')
      .select('id')
      .eq('id', contentItemId)
      .eq('organization_id', context.organizationId)
      .maybeSingle()
    if (!content) return NextResponse.json({ error: 'Le contenu associé est introuvable.' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { data: existing } = await context.supabase
    .from('decisions')
    .select('id, status')
    .eq('organization_id', context.organizationId)
    .eq('title', title)
    .in('status', ['proposed', 'accepted', 'scheduled'])
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, decisionId: existing.id, status: existing.status, message: 'Cette décision est déjà dans la mémoire.' })
  }

  const { data: decision, error } = await context.supabase
    .from('decisions')
    .insert({
      organization_id: context.organizationId,
      content_item_id: contentItemId,
      title,
      rationale,
      status: 'accepted',
      confidence: null,
      evidence: [{ source: 'workspace_metrics', observed_at: now }],
      decided_by: context.userId,
      decided_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !decision) {
    return NextResponse.json({ error: 'La décision n’a pas pu être enregistrée.' }, { status: 500 })
  }

  const admin = createSupabaseAdminClient()
  if (admin) {
    await admin.from('memory_events').insert({
      organization_id: context.organizationId,
      decision_id: decision.id,
      event_type: 'decision_accepted',
      subject_type: contentItemId ? 'content_item' : 'workspace',
      subject_id: contentItemId,
      before_state: { status: 'proposed' },
      after_state: { status: 'accepted', title },
      impact: { measurement_status: 'awaiting_publication' },
      source: 'human_decision',
      confidence: 1,
      observed_at: now,
    })
  }

  revalidatePath('/')
  revalidatePath('/intelligence')
  revalidatePath('/memory')
  return NextResponse.json({ ok: true, decisionId: decision.id, status: 'accepted', message: 'Décision mémorisée. Aneto attendra maintenant son résultat.' })
}
