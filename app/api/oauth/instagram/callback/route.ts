import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { exchangeInstagramCode } from '@/lib/connectors/instagram'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { encryptCredential } from '@/src/security/credentials.mjs'
import { logError } from '@/lib/observability'

export const dynamic = 'force-dynamic'

const appUrl = () => process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app'

function settingsRedirect(key: 'error' | 'success', message: string) {
  const url = new URL('/settings', appUrl())
  url.searchParams.set(key, message)
  const response = NextResponse.redirect(url)
  response.cookies.delete('aneto_instagram_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.redirect(new URL('/login', appUrl()))
  if (!['owner', 'admin'].includes(context.role)) return settingsRedirect('error', 'Connexion Instagram non autorisée.')

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get('aneto_instagram_oauth_state')?.value
  if (request.nextUrl.searchParams.get('error')) return settingsRedirect('error', 'Connexion Instagram annulée.')
  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect('error', 'La demande Instagram a expiré. Recommence la connexion.')
  }

  const admin = createSupabaseAdminClient()
  const encryptionKey = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!admin || !encryptionKey) return settingsRedirect('error', 'Le coffre de connexion n’est pas configuré.')

  try {
    const tokens = await exchangeInstagramCode(code)
    const now = new Date().toISOString()
    const encrypted = encryptCredential(JSON.stringify(tokens), encryptionKey)

    const { data: source, error: sourceError } = await admin.from('sources').upsert({
      organization_id: context.organizationId,
      provider: 'instagram',
      external_account_id: tokens.accountId,
      state: 'connected',
      oauth_scopes: ['instagram_basic', 'instagram_manage_insights'],
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

    await admin.from('sync_runs').upsert({
      organization_id: context.organizationId,
      source_id: source.id,
      status: 'queued',
      idempotency_key: `connect:${tokens.accountId}`,
    }, { onConflict: 'source_id,idempotency_key', ignoreDuplicates: true })

    return settingsRedirect('success', `@${tokens.username} est connecté à Aneto. La première synchronisation est prête.`)
  } catch (error) {
    logError('instagram_oauth_failed', error, { organizationId: context.organizationId })
    const message = error instanceof ConnectorError ? error.message : 'La connexion Instagram n’a pas pu être enregistrée.'
    return settingsRedirect('error', message)
  }
}
