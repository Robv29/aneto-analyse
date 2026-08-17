import type { ReactNode } from 'react'
import { getSessionContext } from '@/lib/data/session'
import { NavRail } from '../_components/nav-rail'

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getSessionContext()
  const identity = session.viewer?.displayName || session.viewer?.email || 'Paramètres'
  const initials = session.viewer?.displayName
    ?.split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '⚙'

  return (
    <div className="shell">
      <NavRail identity={identity} initials={initials} />
      <main className="content">{children}</main>
    </div>
  )
}
