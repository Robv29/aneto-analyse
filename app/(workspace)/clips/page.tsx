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
          <div><span>STUDIO / DÉRUSHAGE</span><h1>Extraits</h1></div>
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

  return (
    <div className="page clips-page page-enter">
      <header className="page-head clips-head">
        <div><span>STUDIO / DÉRUSHAGE</span><h1>Extraits</h1></div>
        <div className="clips-counter"><strong>{board.clips.length}</strong><span>cuts<br />à examiner</span></div>
      </header>
      <section className="clips-manifesto">
        <span>ANETO A DÉJÀ DÉRUSHÉ</span>
        <h2>Tu ne cherches plus dans les vidéos.<br />Tu choisis quoi tester.</h2>
        <p>Chaque cut part d’un passage réellement prononcé. Le classement croise force éditoriale et, lorsqu’elle existe, rétention mesurée. Il sert à ordonner le visionnage — jamais à prédire des vues.</p>
        <details className="score-guide">
          <summary>Comment lire le score de cut ?</summary>
          <div>
            <p><strong>Sans rétention :</strong> 100 % texte — hook, contraste, expérience vécue, fait concret et durée.</p>
            <p><strong>Avec rétention :</strong> 70 % force éditoriale, 20 % rétention relative, 10 % audience encore présente.</p>
            <p><strong>Score IA :</strong> une seconde lecture contradictoire note hook, autonomie, tension, conversation et fidélité au verbatim.</p>
          </div>
        </details>
      </section>
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
