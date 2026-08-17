import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getLibrary } from '@/lib/data/loaders'
import { DemoWelcome } from '../../_components/demo-welcome'
import { SyncedLibrary } from '../../_components/synced-library'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const library = await getLibrary(workspace)
  const transcriptCount = library.filter((item) => item.transcript?.status === 'available').length

  return (
    <div className="page page-enter">
      <header className="libpage-head">
        <div>
          <span className="dash-decision-meta">CONTENUS / BIBLIOTHÈQUE</span>
          <h1>Tout ce qu’Aneto a importé.</h1>
        </div>
        <p>{library.length} contenus · {transcriptCount} transcrits</p>
      </header>
      <SyncedLibrary items={library} total={library.length} />
    </div>
  )
}
