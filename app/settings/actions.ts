'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { AushaClient } from '@/lib/connectors/ausha'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { encryptCredential } from '@/src/security/credentials.mjs'
import { processSyncRunUntil } from '@/lib/sync/runner'

const settingsUrl = (key: 'error' | 'success', message: string) => `/settings?${key}=${encodeURIComponent(message)}`

export async function connectAusha(formData: FormData) {
  const context = await getAuthenticatedOrganization()
  if (!context) redirect('/login')
  if (!['owner', 'admin'].includes(context.role)) redirect(settingsUrl('error', 'Seul un administrateur peut connecter une source.'))

  const showId = String(formData.get('showId') ?? '').trim()
  const accessToken = String(formData.get('accessToken') ?? '').trim()
  if (!/^\d+$/.test(showId) || accessToken.length < 20) redirect(settingsUrl('error', 'Identifiant d’émission ou jeton Ausha invalide.'))

  const admin = createSupabaseAdminClient()
  const encryptionKey = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!admin || !encryptionKey) redirect(settingsUrl('error', 'Le coffre de connexion n’est pas configuré sur Vercel.'))

  let show: { id: string; name: string } | null = null
  let connectionError: string | null = null
  try {
    show = await new AushaClient(accessToken).verifyShow(showId)
  } catch (error) {
    connectionError = error instanceof ConnectorError ? error.message : 'Ausha est momentanément inaccessible.'
  }
  if (!show || connectionError) redirect(settingsUrl('error', connectionError ?? 'Émission Ausha introuvable.'))

  const now = new Date().toISOString()
  const { data: source, error: sourceError } = await admin.from('sources').upsert({
    organization_id: context.organizationId,
    provider: 'ausha',
    external_account_id: show.id,
    state: 'connected',
    updated_at: now,
  }, { onConflict: 'organization_id,provider,external_account_id' }).select('id').single()
  if (sourceError || !source) redirect(settingsUrl('error', 'La source Ausha n’a pas pu être enregistrée.'))

  let encrypted: ReturnType<typeof encryptCredential> | null = null
  try {
    encrypted = encryptCredential(accessToken, encryptionKey)
  } catch {
    // The environment variable exists but is not a valid 32-byte base64 key.
  }
  if (!encrypted) redirect(settingsUrl('error', 'La clé de chiffrement Vercel est invalide.'))
  const { error: credentialError } = await admin.from('source_credentials').upsert({
    source_id: source.id,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    auth_tag: encrypted.authTag,
    updated_at: now,
  })
  if (credentialError) {
    await admin.from('sources').update({ state: 'error', updated_at: new Date().toISOString() }).eq('id', source.id)
    redirect(settingsUrl('error', 'Le jeton Ausha n’a pas pu être protégé.'))
  }

  await admin.from('sync_runs').upsert({
    organization_id: context.organizationId,
    source_id: source.id,
    status: 'queued',
    idempotency_key: `connect:${show.id}`,
  }, { onConflict: 'source_id,idempotency_key', ignoreDuplicates: true })

  revalidatePath('/settings')
  redirect(settingsUrl('success', `${show.name} est connecté. La première synchronisation est en attente.`))
}

export async function enqueueAushaSync(formData: FormData) {
  const context = await getAuthenticatedOrganization()
  if (!context) redirect('/login')
  if (context.role === 'viewer') redirect(settingsUrl('error', 'Ton rôle ne permet pas de lancer une synchronisation.'))

  const sourceId = String(formData.get('sourceId') ?? '')
  const { data: source } = await context.supabase
    .from('sources')
    .select('id')
    .eq('id', sourceId)
    .eq('organization_id', context.organizationId)
    .eq('provider', 'ausha')
    .maybeSingle()
  if (!source) redirect(settingsUrl('error', 'Source Ausha introuvable.'))

  const { error } = await context.supabase.from('sync_runs').insert({
    organization_id: context.organizationId,
    source_id: source.id,
    status: 'queued',
    idempotency_key: `manual:${crypto.randomUUID()}`,
  })
  if (error) redirect(settingsUrl('error', 'La synchronisation n’a pas pu être ajoutée à la file.'))

  revalidatePath('/settings')
  redirect(settingsUrl('success', 'Synchronisation Ausha ajoutée à la file.'))
}

export async function syncYouTubeNow(formData: FormData) {
  const context = await getAuthenticatedOrganization()
  if (!context) redirect('/login')
  if (context.role === 'viewer') redirect(settingsUrl('error', 'Ton rôle ne permet pas de lancer une synchronisation.'))

  const sourceId = String(formData.get('sourceId') ?? '')
  const { data: source } = await context.supabase
    .from('sources')
    .select('id')
    .eq('id', sourceId)
    .eq('organization_id', context.organizationId)
    .eq('provider', 'youtube')
    .maybeSingle()
  if (!source) redirect(settingsUrl('error', 'Source YouTube introuvable.'))

  const { data: queuedRun, error } = await context.supabase.from('sync_runs').insert({
    organization_id: context.organizationId,
    source_id: source.id,
    status: 'queued',
    idempotency_key: `manual:${crypto.randomUUID()}`,
  }).select('id').single()
  if (error || !queuedRun) redirect(settingsUrl('error', 'La synchronisation YouTube n’a pas pu démarrer.'))

  const result = await processSyncRunUntil(queuedRun.id)
  revalidatePath('/settings')
  revalidatePath('/')
  if (result.status === 'succeeded') {
    redirect(settingsUrl('success', `${result.items} vidéo${result.items > 1 ? 's' : ''} synchronisée${result.items > 1 ? 's' : ''} · ${result.transcripts} transcription${result.transcripts > 1 ? 's' : ''} importée${result.transcripts > 1 ? 's' : ''}.`))
  }
  redirect(settingsUrl('error', 'La synchronisation YouTube est en attente ou doit être relancée.'))
}

export async function syncTikTokNow(formData: FormData) {
  const context = await getAuthenticatedOrganization()
  if (!context) redirect('/login')
  if (context.role === 'viewer') redirect(settingsUrl('error', 'Ton rôle ne permet pas de lancer une synchronisation.'))

  const sourceId = String(formData.get('sourceId') ?? '')
  const { data: source } = await context.supabase
    .from('sources')
    .select('id')
    .eq('id', sourceId)
    .eq('organization_id', context.organizationId)
    .eq('provider', 'tiktok')
    .maybeSingle()
  if (!source) redirect(settingsUrl('error', 'Source TikTok introuvable.'))

  const { data: queuedRun, error } = await context.supabase.from('sync_runs').insert({
    organization_id: context.organizationId,
    source_id: source.id,
    status: 'queued',
    idempotency_key: `manual:${crypto.randomUUID()}`,
  }).select('id').single()
  if (error || !queuedRun) redirect(settingsUrl('error', 'La synchronisation TikTok n’a pas pu démarrer.'))

  const result = await processSyncRunUntil(queuedRun.id)
  revalidatePath('/settings')
  revalidatePath('/')
  if (result.status === 'succeeded') {
    redirect(settingsUrl('success', `${result.items} vidéo${result.items > 1 ? 's' : ''} TikTok synchronisée${result.items > 1 ? 's' : ''}.`))
  }
  if (result.status === 'failed') {
    redirect(settingsUrl('error', `TikTok a refusé la synchronisation : ${result.errorMessage}`))
  }
  redirect(settingsUrl('error', 'La synchronisation TikTok est encore en attente. Relance-la dans quelques secondes.'))
}
