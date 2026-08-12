import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { exchangeTikTokCode, TikTokClient } from '@/lib/connectors/tiktok'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { processSyncRunUntil } from '@/lib/sync/runner'
import { encryptCredential } from '@/src/security/credentials.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const appUrl = () => process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app'

function settingsRedirect(key: 'error' | 'success', message: string) {
  const url = new URL('/settings', appUrl())
  url.searchParams.set(key, message)
  const response = NextResponse.redirect(url)
  response.cookies.delete('aneto_tiktok_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.redirect(new URL('/login', appUrl()))
  if (!['owner', 'admin'].includes(context.role)) return settingsRedirect('error', 'Connexion TikTok non autorisée.')

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get('aneto_tiktok_oauth_state')?.value
  const oauthError = request.nextUrl.searchParams.get('error')
  if (oauthError) return settingsRedirect('error', 'Connexion TikTok annulée.')
  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect('error', 'La demande TikTok a expiré. Recommence la connexion.')
  }

  const admin = createSupabaseAdminClient()
  const encryptionKey = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!admin || !encryptionKey) return settingsRedirect('error', 'Le coffre de connexion n’est pas configuré.')

  try {
    const tokens = await exchangeTikTokCode(code)
    const account = await new TikTokClient(tokens.accessToken).getUser()
    if (account.id !== tokens.openId) throw new ConnectorError('Le compte TikTok autorisé ne correspond pas au jeton reçu.', 'account_mismatch')
    const now = new Date().toISOString()
    const encrypted = encryptCredential(JSON.stringify(tokens), encryptionKey)
    const { data: source, error: sourceError } = await admin.from('sources').upsert({
      organization_id: context.organizationId,
      provider: 'tiktok',
      external_account_id: account.id,
      state: 'connected',
      oauth_scopes: tokens.scope.split(',').map((scope) => scope.trim()).filter(Boolean),
      updated_at: now,
    }, { onConflict: 'organization_id,provider,external_account_id' }).select('id').single()
    if (sourceError || !source) throw new Error('source_write_failed')

    const { error: credentialError } = await admin.from('source_credentials').upsert({
      source_id: source.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      updated_at: now,
    })
    if (credentialError) {
      await admin.from('sources').update({ state: 'error', updated_at: now }).eq('id', source.id)
      throw new Error('credential_write_failed')
    }

    const { data: queuedRun, error: queueError } = await admin.from('sync_runs').insert({
      organization_id: context.organizationId,
      source_id: source.id,
      status: 'queued',
      idempotency_key: `connect:${account.id}:${crypto.randomUUID()}`,
    }).select('id').single()
    if (queueError || !queuedRun) throw new Error('sync_queue_failed')

    const syncResult = await processSyncRunUntil(queuedRun.id)
    if (syncResult.status === 'succeeded') {
      return settingsRedirect('success', `${account.displayName} est connecté à Aneto · ${syncResult.items} vidéo${syncResult.items > 1 ? 's' : ''} TikTok importée${syncResult.items > 1 ? 's' : ''}.`)
    }
    if (syncResult.status === 'failed') {
      return settingsRedirect('error', `${account.displayName} est connecté, mais TikTok a refusé l’import : ${syncResult.errorMessage}`)
    }
    return settingsRedirect('success', `${account.displayName} est connecté. La synchronisation TikTok continue en arrière-plan.`)
  } catch (error) {
    const message = error instanceof ConnectorError ? error.message : 'La connexion TikTok n’a pas pu être enregistrée.'
    return settingsRedirect('error', message)
  }
}
