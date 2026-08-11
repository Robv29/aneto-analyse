import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createTikTokAuthorizationUrl } from '@/lib/connectors/tiktok'
import { hasValidCredentialEncryptionKey } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const appUrl = process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app'
  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.redirect(new URL('/login', appUrl))

  const settingsUrl = new URL('/settings', appUrl)
  if (!['owner', 'admin'].includes(context.role)) {
    settingsUrl.searchParams.set('error', 'Seul un administrateur peut connecter TikTok.')
    return NextResponse.redirect(settingsUrl)
  }
  if (!hasValidCredentialEncryptionKey()) {
    settingsUrl.searchParams.set('error', 'La clé de chiffrement Vercel est absente ou invalide.')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const state = randomBytes(32).toString('base64url')
    const response = NextResponse.redirect(createTikTokAuthorizationUrl(state))
    response.cookies.set('aneto_tiktok_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/oauth/tiktok',
      maxAge: 10 * 60,
    })
    return response
  } catch {
    settingsUrl.searchParams.set('error', 'La connexion TikTok n’est pas encore configurée.')
    return NextResponse.redirect(settingsUrl)
  }
}
