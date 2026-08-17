import Link from 'next/link'
import { analyzeContent } from '@/src/analytics.mjs'
import { formatClipTime } from '@/src/clips.mjs'
import { buildClipCopyText } from '@/src/openrouter.mjs'
import { buildDailyDecision } from '@/lib/editorial/daily-decision'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getClipBoard, getDecisions, getLibrary, getSources } from '@/lib/data/loaders'
import { CommitDecision } from '../_components/commit-decision'
import { CopyClipButton } from '../_components/copy-clip-button'
import { DemoWelcome } from '../_components/demo-welcome'
import { compactNumber, contentHref, metricLabel, providerLabel } from '../_components/format'
import { Icon } from '../_components/icons'
import { SyncBar } from '../_components/sync-command'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [sources, library, decisions, board] = await Promise.all([
    getSources(workspace),
    getLibrary(workspace),
    getDecisions(workspace, 4),
    getClipBoard(workspace),
  ])

  const analysis = analyzeContent(library)
  const transcriptCount = library.filter((item) => item.transcript?.status === 'available').length
  const connectedSources = sources.filter((source) => source.state === 'connected')
  const latestSync = connectedSources.map((source) => source.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null
  const firstName = workspace.viewer.displayName?.split(' ')[0] || ''
  const readyShorts = board.clips.slice(0, 3)

  const sourceChips = (
    <div className="dash-sources">
      {sources.length ? sources.map((source) => (
        <span key={source.id} className={`dash-source ${source.state === 'connected' ? 'is-connected' : source.state === 'error' ? 'is-error' : ''}`}>
          <i></i>{providerLabel(source.provider)}
          <small>{source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleDateString('fr-FR') : 'jamais'}</small>
        </span>
      )) : <Link className="dash-link" href="/settings">Connecter une source <Icon name="arrow" size={12} /></Link>}
    </div>
  )

  if (!analysis.count) {
    return (
      <div className="dash page-enter">
        <header className="dash-topbar">
          <h1><small>ANETO / AUJOURD’HUI</small>{workspace.organization.name}</h1>
          {sourceChips}
        </header>
        {connectedSources.length ? <SyncBar connectedCount={connectedSources.length} latestSync={latestSync} /> : null}
        <div className="dash-empty">
          <strong>{connectedSources.length ? 'Lance la première synchronisation.' : 'Connecte ta première source.'}</strong>
          <p>
            {connectedSources.length
              ? 'Aneto va importer tes contenus, leurs statistiques et leurs transcriptions, puis préparer les premiers extraits.'
              : 'YouTube, TikTok ou Ausha : une fois la source connectée dans les paramètres, tout le reste est automatique.'}
          </p>
          {!connectedSources.length ? <Link href="/settings">Ouvrir les paramètres <Icon name="arrow" size={13} /></Link> : null}
        </div>
      </div>
    )
  }

  const decision = buildDailyDecision(analysis, board.clips, transcriptCount)
  const recentContents = library.slice(0, 5)

  return (
    <div className="dash page-enter">
      <header className="dash-topbar">
        <h1><small>ANETO / AUJOURD’HUI</small>{firstName ? `Bonjour ${firstName}.` : workspace.organization.name}</h1>
        {sourceChips}
      </header>

      <SyncBar connectedCount={connectedSources.length} latestSync={latestSync} />

      <section className="dash-kpis" aria-label="Indicateurs">
        <div className="dash-kpi"><small>CONTENUS</small><strong>{analysis.count}</strong><span>{transcriptCount} transcrits</span></div>
        <div className="dash-kpi"><small>VUES CUMULÉES</small><strong>{compactNumber(analysis.totalViews)}</strong><span>{compactNumber(analysis.totalLikes + analysis.totalComments)} réactions</span></div>
        <div className="dash-kpi"><small>ENGAGEMENT</small><strong>{analysis.engagementRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</strong><span>réactions / vues</span></div>
        <div className="dash-kpi"><small>SHORTS PRÊTS</small><strong className="is-accent">{board.clips.length}</strong><span>{board.aiClipCount} analysés par l’IA</span></div>
      </section>

      <div className="dash-main">
        <div className="dash-col">
          <section className="dash-card dash-decision">
            <span className="dash-decision-meta">{decision.label} · {decision.confidence}</span>
            <h2>{decision.title}</h2>
            <p>{decision.rationale}</p>
            <div className="dash-decision-actions">
              <Link href={decision.href}>{decision.cta} <Icon name="arrow" size={14} /></Link>
              {decision.commit ? <CommitDecision decision={decision.commit} /> : null}
            </div>
            <details className="dash-why">
              <summary>Pourquoi cette recommandation</summary>
              <ul>
                {decision.proofs.map((proof) => (
                  <li key={proof.label}><b>{proof.label}</b>{proof.text}</li>
                ))}
              </ul>
            </details>
          </section>

          <section className="dash-card">
            <header>
              <span>SHORTS À PUBLIER</span>
              <Link href="/clips">Tous les shorts <Icon name="arrow" size={12} /></Link>
            </header>
            {readyShorts.length ? (
              <div className="dash-shorts">
                {readyShorts.map((clip) => (
                  <article key={clip.id} className="dash-short">
                    <div className="dash-short-score">{clip.score}<small>/100</small></div>
                    <div className="dash-short-copy">
                      <strong>{clip.title}</strong>
                      <span>{clip.contentTitle} · {formatClipTime(clip.start)} → {formatClipTime(clip.end)} · {clip.duration} s</span>
                    </div>
                    <div className="dash-short-actions">
                      {clip.aiEnhanced && clip.caption ? <CopyClipButton text={buildClipCopyText(clip) as string} /> : null}
                      <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(clip.externalId)}&t=${clip.start}s`} target="_blank" rel="noreferrer">Voir</a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dash-empty">
                <strong>Pas encore d’extrait minuté.</strong>
                <p>{transcriptCount ? 'La prochaine synchronisation récupérera les timecodes des transcriptions.' : 'Autorise les transcriptions YouTube dans les paramètres puis synchronise.'}</p>
              </div>
            )}
          </section>
        </div>

        <div className="dash-col">
          <section className="dash-card">
            <header>
              <span>DERNIERS CONTENUS</span>
              <Link href="/library">Bibliothèque <Icon name="arrow" size={12} /></Link>
            </header>
            <div className="dash-list">
              {recentContents.map((item) => {
                const href = contentHref(item)
                const row = (
                  <>
                    <div className="dash-row-copy">
                      <strong>{item.title}</strong>
                      <small>
                        {providerLabel(item.provider).toUpperCase()}
                        {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString('fr-FR')}` : ''}
                        {item.transcript?.status === 'available' ? ' · transcrit' : ''}
                      </small>
                    </div>
                    <div className="dash-row-metric">
                      <b>{compactNumber(item.kind === 'video' ? item.payload.viewCount : item.payload.downloadsCount)}</b>
                      <small>{metricLabel(item)}</small>
                    </div>
                  </>
                )
                if (!href) return <div key={item.id} className="dash-row">{row}</div>
                return href.startsWith('http')
                  ? <a key={item.id} className="dash-row" href={href} target="_blank" rel="noreferrer">{row}</a>
                  : <Link key={item.id} className="dash-row" href={href}>{row}</Link>
              })}
            </div>
          </section>

          <section className="dash-card">
            <header>
              <span>DÉCISIONS RETENUES</span>
              <Link href="/memory">Historique <Icon name="arrow" size={12} /></Link>
            </header>
            {decisions.length ? (
              <div className="dash-list">
                {decisions.map((item) => (
                  <div key={item.id} className="dash-row">
                    <div className="dash-row-copy">
                      <strong>{item.title}</strong>
                      <small>{new Date(item.createdAt).toLocaleDateString('fr-FR')} · {item.status}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty">
                <strong>Aucune décision retenue.</strong>
                <p>Retiens une recommandation pour qu’Aneto en mesure le résultat.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
