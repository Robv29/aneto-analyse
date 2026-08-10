import 'server-only'
import { AushaClient } from '@/lib/connectors/ausha'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { decryptCredential } from '@/src/security/credentials.mjs'

type ClaimedRun = {
  id: string
  organization_id: string
  source_id: string
  attempt: number
}

const safeMessage = (error: unknown) => error instanceof ConnectorError
  ? `${error.code}: ${error.message}`
  : error instanceof Error ? error.message.slice(0, 500) : 'unknown_sync_error'

export async function enqueueDailySyncRuns() {
  const admin = createSupabaseAdminClient()
  if (!admin) return { enqueued: 0 }

  const { data: sources, error } = await admin.from('sources').select('id, organization_id').eq('state', 'connected')
  if (error) throw error
  if (!sources?.length) return { enqueued: 0 }

  const day = new Date().toISOString().slice(0, 10)
  const rows = sources.map((source) => ({
    organization_id: source.organization_id,
    source_id: source.id,
    status: 'queued',
    idempotency_key: `daily:${day}`,
  }))
  const { data, error: enqueueError } = await admin
    .from('sync_runs')
    .upsert(rows, { onConflict: 'source_id,idempotency_key', ignoreDuplicates: true })
    .select('id')
  if (enqueueError) throw enqueueError
  return { enqueued: data?.length ?? 0 }
}

export async function processNextSyncRun() {
  const admin = createSupabaseAdminClient()
  const encryptionKey = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!admin || !encryptionKey) return { status: 'not_configured' as const }

  const { data: claimed, error: claimError } = await admin.rpc('claim_next_sync_run')
  if (claimError) throw claimError
  const run = (claimed?.[0] ?? null) as ClaimedRun | null
  if (!run) return { status: 'idle' as const }

  try {
    const [{ data: source, error: sourceError }, { data: credential, error: credentialError }] = await Promise.all([
      admin.from('sources').select('id, organization_id, provider, external_account_id').eq('id', run.source_id).single(),
      admin.from('source_credentials').select('ciphertext, iv, auth_tag').eq('source_id', run.source_id).single(),
    ])
    if (sourceError || !source) throw sourceError ?? new Error('source_not_found')
    if (credentialError || !credential) throw credentialError ?? new Error('credential_not_found')
    if (source.provider !== 'ausha' || !source.external_account_id) throw new Error('unsupported_source')

    const accessToken = decryptCredential({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.auth_tag,
    }, encryptionKey)
    const episodes = await new AushaClient(accessToken).listEpisodes(source.external_account_id)
    const syncedAt = new Date().toISOString()
    const rows = episodes.map((episode) => ({
      organization_id: source.organization_id,
      source_id: source.id,
      kind: 'episode',
      external_id: episode.externalId,
      title: episode.title,
      published_at: episode.publishedAt,
      source_observed_at: episode.observedAt,
      synced_at: syncedAt,
      confidence: 1,
      provenance: {
        provider: 'ausha',
        endpoint: `/v1/shows/${source.external_account_id}/podcasts`,
        synced_at: syncedAt,
      },
      payload: episode.payload,
      updated_at: syncedAt,
    }))

    if (rows.length) {
      const { error: upsertError } = await admin.from('content_items').upsert(rows, {
        onConflict: 'organization_id,source_id,external_id',
      })
      if (upsertError) throw upsertError
    }

    await Promise.all([
      admin.from('sources').update({ state: 'connected', last_synced_at: syncedAt, updated_at: syncedAt }).eq('id', source.id),
      admin.from('sync_runs').update({
        status: 'succeeded', finished_at: syncedAt, metrics: { items: rows.length }, error_code: null, error_message: null,
      }).eq('id', run.id),
    ])
    return { status: 'succeeded' as const, runId: run.id, items: rows.length }
  } catch (error) {
    const retryAfter = error instanceof ConnectorError ? error.retryAfterSeconds : null
    const shouldRetry = run.attempt < 3 && !(error instanceof ConnectorError && error.code === 'unauthorized')
    const delaySeconds = retryAfter ?? Math.min(300, 30 * (2 ** run.attempt))
    await admin.from('sync_runs').update(shouldRetry ? {
      status: 'queued',
      attempt: run.attempt + 1,
      available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      locked_at: null,
      error_code: error instanceof ConnectorError ? error.code : 'sync_error',
      error_message: safeMessage(error),
    } : {
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_code: error instanceof ConnectorError ? error.code : 'sync_error',
      error_message: safeMessage(error),
    }).eq('id', run.id)
    return { status: shouldRetry ? 'retry_scheduled' as const : 'failed' as const, runId: run.id }
  }
}
