import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getClipBoard, getLibrary, getPendingAnalysisCount, getSources } from '@/lib/data/loaders'
import { ClipCard } from '../../_components/clip-card'
import { DemoWelcome } from '../../_components/demo-welcome'
import { EnrichClips } from '../../_components/enrich-clips'
import { Icon } from '../../_components/icons'
import { SyncRetryButton } from '../../_components/sync-command'

export const dynamic = 'force-dynamic'

export default async function ClipsPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [board, library, sources, pendingCount] = await Promise.all([
    getClipBoard(workspace),
    getLibrary(workspace),
    getSources(workspace),
    getPendingAnalysisCount(workspace),
  ])
  const transcriptCount = library.filter((item) => item.transcript?.status === 'available').length

  if (!board.clips.length) {
    const hasText = transcriptCount > 0
    const hasConnectedSource = sources.some((source) => source.state === 'connected')
    return (
      <div className="page clips-page page-enter">
        <header className="page-head clips-head">
          <div><span>SHORTS / DÉRUSHAGE</span><h1>Shorts</h1></div>
        </header>
        <section className="clips-empty">
          <span><Icon name="clip" size={28} /></span>
          <small>{hasText ? 'TEXTES DISPONIBLES · TIMECODES ABSENTS' : 'MATIÈRE À RÉCUPÉRER'}</small>
          <h2>{hasText
            ? 'Une dernière synchronisation pour retrouver chaque passage à la seconde près.'
            : 'Aneto doit entendre les vidéos avant de proposer des cuts.'}</h2>
          <p>{hasText
            ? 'Les anciennes transcriptions ont été importées sans leurs repères temporels. La prochaine synchronisation les enrichira automatiquement.'
            : 'Autorise les transcriptions YouTube puis lance la synchronisation globale.'}</p>
          <SyncRetryButton label={hasText ? 'Récupérer les timecodes' : 'Synchroniser les vidéos'} disabled={!hasConnectedSource} />
        </section>
      </div>
    )
  }

  const timedVideos = new Set(board.clips.map((clip) => clip.contentItemId)).size

  return (
    <div className="page clips-page page-enter">
      <header className="page-head clips-head">
        <div><span>SHORTS / DÉRUSHAGE</span><h1>Shorts</h1></div>
        <div className="clips-counter"><strong>{board.clips.length}</strong><span>cuts<br />à examiner</span></div>
      </header>
      <div className="clips-stats">
        <span><b>{board.clips.length}</b> passages minutés</span>
        <span><b>{timedVideos}</b> vidéo{timedVideos > 1 ? 's' : ''} dérushée{timedVideos > 1 ? 's' : ''}</span>
        <span><b>{board.aiClipCount}</b> analysés par l’IA</span>
        {pendingCount ? <span><b>{pendingCount}</b> en attente d’analyse</span> : null}
      </div>
      <EnrichClips aiClipCount={board.aiClipCount} pendingCount={pendingCount} />
      {board.marketStudy ? (
        <section className="clip-market-study">
          <div className="section-label">
            <span>BENCHMARK ÉDITORIAL INTERNE</span>
            <em>Ce que les données permettent — et ne permettent pas — d’affirmer</em>
          </div>
          <div className="clip-market-grid">
            <article><small>OPPORTUNITÉ</small><p>{board.marketStudy.opportunity}</p></article>
            <article><small>AUDIENCE À VISER</small><p>{board.marketStudy.audience}</p></article>
            <article><small>DIFFÉRENCIATION</small><p>{board.marketStudy.differentiation}</p></article>
            <article><small>SIGNAL OBSERVÉ</small><p>{board.marketStudy.marketSignal}</p></article>
            <article className="is-caution"><small>LIMITES DE LA PREUVE</small><p>{board.marketStudy.limits}</p></article>
            <article className="is-test"><small>PROCHAIN TEST DÉCISIF</small><p>{board.marketStudy.nextTest}</p></article>
          </div>
        </section>
      ) : null}
      <section className="clip-table">
        <div className="section-label">
          <span>SHORTS À PRÉPARER</span>
          <em>Classés par force éditoriale du texte</em>
        </div>
        {board.clips.slice(0, 18).map((clip, index) => (
          <ClipCard key={clip.id} clip={clip} index={index} />
        ))}
      </section>
    </div>
  )
}
