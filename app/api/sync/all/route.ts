import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { drainSyncQueue, releaseStaleSyncRuns } from '@/lib/sync/runner'

export const maxDuration = 60

const supportedProviders = new Set(['ausha', 'youtube', 'tiktok', 'instagram'])

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

  // Une source déjà en file ou en cours n'est pas ré-empilée : cela borne
  // naturellement les déclenchements répétés du bouton.
  const { data: activeRuns } = await context.supabase
    .from('sync_runs')
    .select('source_id')
    .eq('organization_id', context.organizationId)
    .in('status', ['queued', 'running'])
  const busySourceIds = new Set((activeRuns ?? []).map((run) => run.source_id))
  const sourcesToQueue = syncableSources.filter((source) => !busySourceIds.has(source.id))

  if (sourcesToQueue.length) {
    const batchId = crypto.randomUUID()
    const { error: queueError } = await context.supabase
      .from('sync_runs')
      .insert(sourcesToQueue.map((source) => ({
        organization_id: context.organizationId,
        source_id: source.id,
        status: 'queued',
        idempotency_key: `sync-all:${batchId}:${source.id}`,
      })))
    if (queueError) {
      return NextResponse.json({ error: 'La synchronisation globale n’a pas pu démarrer.' }, { status: 500 })
    }
  }

  await releaseStaleSyncRuns()
  const drain = await drainSyncQueue({ organizationId: context.organizationId, budgetMs: 45_000 })

  revalidatePath('/', 'layout')

  const pending = drain.drained ? 0 : Math.max(0, syncableSources.length - drain.processed) + drain.retries
  const partial = drain.failed > 0 || !drain.drained || drain.retries > 0
  return NextResponse.json({
    ok: !partial,
    status: partial ? 'partial' : 'succeeded',
    sources: syncableSources.length,
    completed: drain.succeeded,
    pending,
    failed: drain.failed,
    items: drain.items,
    transcripts: drain.transcripts,
    transcriptsPending: drain.transcriptsPending,
    syncedAt: new Date().toISOString(),
    message: partial
      ? `${drain.succeeded} source${drain.succeeded > 1 ? 's' : ''} traitée${drain.succeeded > 1 ? 's' : ''}${drain.failed ? ` · ${drain.failed} en échec` : ''}${pending ? ` · ${pending} en file, reprise à la prochaine synchronisation` : ''}.`
      : `${drain.succeeded} source${drain.succeeded > 1 ? 's' : ''} synchronisée${drain.succeeded > 1 ? 's' : ''} · ${drain.items} contenu${drain.items > 1 ? 's' : ''} à jour · ${drain.transcripts} transcription${drain.transcripts > 1 ? 's' : ''} importée${drain.transcripts > 1 ? 's' : ''}.`,
  })
}
