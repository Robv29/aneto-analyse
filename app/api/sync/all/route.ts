import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { processNextSyncRun } from '@/lib/sync/runner'

export const maxDuration = 60

const supportedProviders = new Set(['ausha', 'youtube'])

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') {
    return NextResponse.json({ error: 'Ton rôle ne permet pas de lancer une synchronisation.' }, { status: 403 })
  }

  const { data: sources, error: sourceError } = await context.supabase
    .from('sources')
    .select('id, provider')
    .eq('organization_id', context.organizationId)
    .eq('state', 'connected')

  if (sourceError) return NextResponse.json({ error: 'Les sources connectées sont momentanément inaccessibles.' }, { status: 500 })

  const syncableSources = (sources ?? []).filter((source) => supportedProviders.has(source.provider))
  if (!syncableSources.length) {
    return NextResponse.json({ error: 'Aucune source synchronisable n’est connectée.' }, { status: 400 })
  }

  const batchId = crypto.randomUUID()
  const { data: queuedRuns, error: queueError } = await context.supabase
    .from('sync_runs')
    .insert(syncableSources.map((source) => ({
      organization_id: context.organizationId,
      source_id: source.id,
      status: 'queued',
      idempotency_key: `sync-all:${batchId}:${source.id}`,
    })))
    .select('id')

  if (queueError || !queuedRuns?.length) {
    return NextResponse.json({ error: 'La synchronisation globale n’a pas pu démarrer.' }, { status: 500 })
  }

  const pendingRunIds = new Set(queuedRuns.map((run) => run.id))
  let items = 0
  let transcripts = 0
  let transcriptsPending = 0
  let failed = 0
  const maxClaims = Math.max(12, pendingRunIds.size * 5)

  for (let claim = 0; claim < maxClaims && pendingRunIds.size; claim += 1) {
    const result = await processNextSyncRun()
    if (result.status === 'idle' || result.status === 'not_configured') break
    if (!('runId' in result) || !pendingRunIds.has(result.runId)) continue

    if (result.status === 'succeeded') {
      items += result.items
      transcripts += result.transcripts
      transcriptsPending += result.transcriptsPending
      pendingRunIds.delete(result.runId)
    } else if (result.status === 'failed') {
      failed += 1
      pendingRunIds.delete(result.runId)
    }
  }

  revalidatePath('/')
  revalidatePath('/memory')
  revalidatePath('/settings')

  const completed = queuedRuns.length - pendingRunIds.size
  const partial = failed > 0 || pendingRunIds.size > 0
  return NextResponse.json({
    ok: !partial,
    status: partial ? 'partial' : 'succeeded',
    sources: queuedRuns.length,
    completed,
    pending: pendingRunIds.size,
    failed,
    items,
    transcripts,
    transcriptsPending,
    syncedAt: new Date().toISOString(),
    message: partial
      ? `${completed} source${completed > 1 ? 's' : ''} traitée${completed > 1 ? 's' : ''}. Le reste continue en arrière-plan.`
      : `${queuedRuns.length} source${queuedRuns.length > 1 ? 's' : ''} synchronisée${queuedRuns.length > 1 ? 's' : ''} · ${items} contenu${items > 1 ? 's' : ''} à jour · ${transcripts} transcription${transcripts > 1 ? 's' : ''} importée${transcripts > 1 ? 's' : ''}.`,
  })
}
