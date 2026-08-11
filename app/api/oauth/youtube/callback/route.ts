import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { exchangeYouTubeCode, getAuthorizedYouTubeChannel } from '@/lib/connectors/youtube'
import { ConnectorError } from '@/lib/connectors/types'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { encryptCredential } from '@/src/security/credentials.mjs'

export const dynamic = 'force-dynamic'

const appUrl = () => process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app'

function settingsRedirect(key: 'error' | 'success', message: string) {
  const url = new URL('/settings', appUrl())
  url.searchParams.set(key, message)
  const response = NextResponse.redirect(url)
  response.cookies.delete('aneto_youtube_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.redirect(new URL('/login', appUrl()))
  if (!['owner', 'admin'].includes(context.role)) return settingsRedirect('error', 'Connexion YouTube non autorisée.')

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get('aneto_youtube_oauth_state')?.value
  const oauthError = request.nextUrl.searchParams.get('error')
  if (oauthError) return settingsRedirect('error', 'Connexion YouTube annulée.')
  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect('error', 'La demande YouTube a expiré. Recommence la connexion.')
  }

  const admin = createSupabaseAdminClient()
  const encryptionKey = process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY
  if (!admin || !encryptionKey) return settingsRedirect('error', 'Le coffre de connexion n’est pas configuré.')

  try {
    const tokens = await exchangeYouTubeCode(code)
    const channel = await getAuthorizedYouTubeChannel(tokens.accessToken)
    const now = new Date().toISOString()
    let encrypted: ReturnType<typeof encryptCredential>
    try {
      encrypted = encryptCredential(JSON.stringify(tokens), encryptionKey)
    } catch {
      return settingsRedirect('error', 'La clé de chiffrement Vercel est invalide. La chaîne n’a pas été enregistrée.')
    }
    const { data: source, error: sourceError } = await admin.from('sources').upsert({
      organization_id: context.organizationId,
      provider: 'youtube',
      external_account_id: channel.id,
      state: 'connected',
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
      await admin.from('sources').update({ state: 'error', updated_at: new Date().toISOString() }).eq('id', source.id)
      throw new Error('credential_write_failed')
    }

    await admin.from('sync_runs').upsert({
      organization_id: context.organizationId,
      source_id: source.id,
      status: 'queued',
      idempotency_key: `connect:${channel.id}`,
    }, { onConflict: 'source_id,idempotency_key', ignoreDuplicates: true })

    return settingsRedirect('success', `${channel.title} est connectée à Aneto. La première synchronisation est prête.`)
  } catch (error) {
    const message = error instanceof ConnectorError ? error.message : 'La connexion YouTube n’a pas pu être enregistrée.'
    return settingsRedirect('error', message)
  }
}
