import 'server-only'
import { AushaClient } from '@/lib/connectors/ausha'
import { refreshYouTubeTokens, YouTubeClient, YOUTUBE_CAPTIONS_SCOPE, type YouTubeTokens } from '@/lib/connectors/youtube'
import { refreshTikTokTokens, TikTokClient, type TikTokTokens } from '@/lib/connectors/tiktok'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { decryptCredential, encryptCredential } from '@/src/security/credentials.mjs'
import { extractTranscriptKeywords } from '@/src/analytics.mjs'

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
    if (!source.external_account_id) throw new Error('missing_external_account_id')

    const storedCredential = decryptCredential({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.auth_tag,
    }, encryptionKey)
    let items
    let kind: 'episode' | 'video'
    let provenanceEndpoint: string
    let youtubeClient: YouTubeClient | null = null
    let youtubeScopes = ''

    if (source.provider === 'ausha') {
      items = await new AushaClient(storedCredential).listEpisodes(source.external_account_id)
      kind = 'episode'
      provenanceEndpoint = `/v1/shows/${source.external_account_id}/podcasts`
    } else if (source.provider === 'youtube') {
      let tokens: YouTubeTokens
      try {
        tokens = JSON.parse(storedCredential) as YouTubeTokens
      } catch {
        throw new ConnectorError('Identifiants YouTube illisibles.', 'invalid_credentials')
      }
      if (!tokens.refreshToken) throw new ConnectorError('Autorisation YouTube incomplète.', 'invalid_credentials')
      const refreshed = await refreshYouTubeTokens(tokens)
      youtubeClient = new YouTubeClient(refreshed.accessToken)
      youtubeScopes = refreshed.scope
      items = await youtubeClient.listVideos(source.external_account_id)
      kind = 'video'
      provenanceEndpoint = '/youtube/v3/playlistItems + /youtube/v3/videos'

      const encrypted = encryptCredential(JSON.stringify(refreshed), encryptionKey)
      const { error: updateCredentialError } = await admin.from('source_credentials').update({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        updated_at: new Date().toISOString(),
      }).eq('source_id', source.id)
      if (updateCredentialError) throw updateCredentialError
    } else if (source.provider === 'tiktok') {
      let tokens: TikTokTokens
      try {
        tokens = JSON.parse(storedCredential) as TikTokTokens
      } catch {
        throw new ConnectorError('Identifiants TikTok illisibles.', 'invalid_credentials')
      }
      if (!tokens.refreshToken) throw new ConnectorError('Autorisation TikTok incomplète.', 'invalid_credentials')
      const refreshed = await refreshTikTokTokens(tokens)
      const tiktokClient = new TikTokClient(refreshed.accessToken)
      items = await tiktokClient.listVideos(4)
      kind = 'video'
      provenanceEndpoint = '/v2/video/list/'

      const encrypted = encryptCredential(JSON.stringify(refreshed), encryptionKey)
      const { error: updateCredentialError } = await admin.from('source_credentials').update({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        updated_at: new Date().toISOString(),
      }).eq('source_id', source.id)
      if (updateCredentialError) throw updateCredentialError
    } else {
      throw new Error('unsupported_source')
    }

    const syncedAt = new Date().toISOString()
    const rows = items.map((item) => ({
      organization_id: source.organization_id,
      source_id: source.id,
      kind,
      external_id: item.externalId,
      title: item.title,
      published_at: item.publishedAt,
      source_observed_at: item.observedAt,
      synced_at: syncedAt,
      confidence: 1,
      provenance: {
        provider: source.provider,
        endpoint: provenanceEndpoint,
        synced_at: syncedAt,
      },
      payload: item.payload,
      updated_at: syncedAt,
    }))

    let persistedItems: Array<{ id: string; external_id: string }> = []
    if (rows.length) {
      const { data: upsertedItems, error: upsertError } = await admin.from('content_items').upsert(rows, {
        onConflict: 'organization_id,source_id,external_id',
      }).select('id, external_id')
      if (upsertError) throw upsertError
      persistedItems = upsertedItems ?? []
    }

    let transcriptsAvailable = 0
    let transcriptsPending = 0
    if (source.provider === 'youtube' && youtubeClient && persistedItems.length) {
      const hasCaptionsScope = youtubeScopes.split(/\s+/).includes(YOUTUBE_CAPTIONS_SCOPE)
      const { data: existingTranscripts } = await admin
        .from('content_transcripts')
        .select('content_item_id, status, updated_at, provenance')
        .eq('organization_id', source.organization_id)

      const existingByContent = new Map((existingTranscripts ?? []).map((transcript) => [transcript.content_item_id, transcript]))
      if (!hasCaptionsScope) {
        const transcriptRows = persistedItems.map((item) => ({
          organization_id: source.organization_id,
          content_item_id: item.id,
          source: 'youtube_captions',
          status: 'authorization_required',
          plain_text: null,
          word_count: 0,
          keywords: [],
          provenance: { provider: 'youtube', reason: 'missing_captions_scope' },
          updated_at: syncedAt,
        }))
        const { error: transcriptError } = await admin.from('content_transcripts').upsert(transcriptRows, { onConflict: 'content_item_id' })
        if (!transcriptError) transcriptsPending = transcriptRows.length
      } else {
        const staleUnavailable = Date.now() - 7 * 24 * 60 * 60 * 1000
        const candidates = persistedItems.filter((item) => {
          const transcript = existingByContent.get(item.id)
          if (!transcript || transcript.status === 'authorization_required' || transcript.status === 'error') return true
          if (transcript.status === 'available' && (!Array.isArray(transcript.provenance?.timed_segments) || !Array.isArray(transcript.provenance?.retention_points))) return true
          return transcript.status === 'unavailable' && new Date(transcript.updated_at).getTime() < staleUnavailable
        }).slice(0, 12)

        const transcriptRows = await Promise.all(candidates.map(async (item) => {
          try {
            const [transcript, retentionPoints] = await Promise.all([
              youtubeClient!.getTranscript(item.external_id),
              youtubeClient!.getAudienceRetention(item.external_id).catch(() => []),
            ])
            return {
              organization_id: source.organization_id,
              content_item_id: item.id,
              source: 'youtube_captions',
              status: transcript.status,
              language: transcript.language,
              track_kind: transcript.trackKind,
              caption_track_id: transcript.captionTrackId,
              plain_text: transcript.text,
              word_count: transcript.text ? transcript.text.split(/\s+/).filter(Boolean).length : 0,
              keywords: transcript.text ? extractTranscriptKeywords(transcript.text) : [],
              provenance: { provider: 'youtube', endpoint: '/youtube/v3/captions + youtubeanalytics/v2/reports', caption_last_updated: transcript.lastUpdated, timed_segments: transcript.segments, retention_points: retentionPoints },
              updated_at: syncedAt,
            }
          } catch (error) {
            return {
              organization_id: source.organization_id,
              content_item_id: item.id,
              source: 'youtube_captions',
              status: error instanceof ConnectorError && error.code === 'captions_unauthorized' ? 'authorization_required' : 'error',
              language: null,
              track_kind: null,
              caption_track_id: null,
              plain_text: null,
              word_count: 0,
              keywords: [],
              provenance: { provider: 'youtube', error: safeMessage(error) },
              updated_at: syncedAt,
            }
          }
        }))
        if (transcriptRows.length) {
          const { error: transcriptError } = await admin.from('content_transcripts').upsert(transcriptRows, { onConflict: 'content_item_id' })
          if (!transcriptError) {
            transcriptsAvailable = transcriptRows.filter((row) => row.status === 'available').length
            transcriptsPending = transcriptRows.filter((row) => row.status !== 'available').length
          }
        }
      }
    }

    await Promise.all([
      admin.from('sources').update({ state: 'connected', last_synced_at: syncedAt, updated_at: syncedAt }).eq('id', source.id),
      admin.from('sync_runs').update({
        status: 'succeeded', finished_at: syncedAt, metrics: { items: rows.length, transcripts_available: transcriptsAvailable, transcripts_pending: transcriptsPending }, error_code: null, error_message: null,
      }).eq('id', run.id),
    ])
    return { status: 'succeeded' as const, runId: run.id, items: rows.length, transcripts: transcriptsAvailable, transcriptsPending }
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
    if (!shouldRetry) {
      await admin.from('sources').update({ state: 'error', updated_at: new Date().toISOString() }).eq('id', run.source_id)
    }
    return { status: shouldRetry ? 'retry_scheduled' as const : 'failed' as const, runId: run.id }
  }
}
