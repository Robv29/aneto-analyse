import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createYouTubeAuthorizationUrl } from '@/lib/connectors/youtube'

export const dynamic = 'force-dynamic'

export async function GET() {
  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.redirect(new URL('/login', process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app'))

  const settingsUrl = new URL('/settings', process.env.ANETO_APP_URL ?? 'https://aneto-analyse.vercel.app')
  if (!['owner', 'admin'].includes(context.role)) {
    settingsUrl.searchParams.set('error', 'Seul un administrateur peut connecter YouTube.')
    return NextResponse.redirect(settingsUrl)
  }
  if (!process.env.ANETO_CREDENTIAL_ENCRYPTION_KEY) {
    settingsUrl.searchParams.set('error', 'Le coffre de connexion n’est pas configuré sur Vercel.')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const state = randomBytes(32).toString('base64url')
    const response = NextResponse.redirect(createYouTubeAuthorizationUrl(state))
    response.cookies.set('aneto_youtube_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/oauth/youtube',
      maxAge: 10 * 60,
    })
    return response
  } catch {
    settingsUrl.searchParams.set('error', 'La connexion YouTube n’est pas disponible.')
    return NextResponse.redirect(settingsUrl)
  }
}
