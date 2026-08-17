import 'server-only'
import { redirect } from 'next/navigation'
import { asActiveWorkspace, getSessionContext, type ActiveWorkspace } from '@/lib/data/session'

// Retourne l'espace de travail actif, redirige vers /login ou /onboarding si
// nécessaire, ou null lorsque Supabase n'est pas configuré (mode démo).
export async function getWorkspaceOrDemo(): Promise<ActiveWorkspace | null> {
  const session = await getSessionContext()
  if (session.mode === 'demo') return null
  if (!session.viewer) redirect('/login')
  const active = asActiveWorkspace(session)
  if (!active) redirect('/onboarding')
  return active
}
