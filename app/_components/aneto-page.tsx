import { AnetoClient } from './aneto-client'
import { getWorkspaceSnapshot } from '@/lib/data/workspace'
import { redirect } from 'next/navigation'

export async function AnetoPage() {
  const bootstrap = await getWorkspaceSnapshot()

  if (bootstrap.mode === 'live' && !bootstrap.viewer) redirect('/login')
  if (bootstrap.mode === 'live' && !bootstrap.organization) redirect('/onboarding')

  return <AnetoClient bootstrap={bootstrap} />
}
