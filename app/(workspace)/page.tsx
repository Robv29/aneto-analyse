import Link from 'next/link'
import { analyzeContent, primaryMetric } from '@/src/analytics.mjs'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getClipBoard, getDecisions, getLibrary, getMemoryEvents, getSources } from '@/lib/data/loaders'
import { DemoWelcome } from '../_components/demo-welcome'
import { compactNumber, fullNumber, metricLabel, providerLabel } from '../_components/format'
import { Icon } from '../_components/icons'
import { Recommendations, type Recommendation } from '../_components/recommendations'
import { SyncCommand } from '../_components/sync-command'
import { SyncedLibrary } from '../_components/synced-library'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [sources, library, decisions, memoryEvents, board] = await Promise.all([
    getSources(workspace),
    getLibrary(workspace),
    getDecisions(workspace),
    getMemoryEvents(workspace),
    getClipBoard(workspace),
  ])

  const analysis = analyzeContent(library)
  const transcriptCount = library.filter((item) => item.transcript?.status === 'available').length
  const firstName = workspace.viewer.displayName?.split(' ')[0] || ''
  const connectedSources = sources.filter((source) => source.state === 'connected')
  const latestSync = connectedSources.map((source) => source.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null

  const persistedRecommendations: Recommendation[] = decisions.map((decision) => ({
    type: 'DÉCISION',
    icon: decision.status === 'accepted' ? '✓' : '↗',
    tone: decision.status === 'accepted' ? 'lime' : 'blue',
    title: decision.title,
    note: decision.rationale,
    confidence: decision.confidence === null ? '—' : `${Math.round(decision.confidence * 100)} %`,
    action: decision.status,
    detail: decision.rationale,
    origin: 'persisted',
    proofLines: [],
  }))

  const proofLines = [
    `${analysis.count} contenus synchronisés`,
    `${compactNumber(analysis.totalViews)} vues`,
    `${compactNumber(analysis.totalLikes)} likes`,
    `${compactNumber(analysis.totalComments)} commentaires`,
  ]
  const mostCommented = analysis.totalComments
    ? [...analysis.ranked].sort((a, b) => (Number(b.payload?.commentCount) || 0) - (Number(a.payload?.commentCount) || 0))[0]
    : null
  const derivedRecommendations: Recommendation[] = analysis.count ? [
    {
      type: 'PERFORMANCE',
      icon: '↗',
      tone: 'lime',
      title: `Capitaliser sur « ${analysis.top.title} »`,
      note: `C’est le contenu le plus performant parmi les ${analysis.count} éléments synchronisés.`,
      confidence: 'Donnée réelle',
      action: `${compactNumber(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}`,
      detail: `Ce contenu domine actuellement la bibliothèque avec ${fullNumber(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}. La recommandation est calculée uniquement à partir des données synchronisées.`,
      origin: 'derived',
      proofLines,
    },
    ...(mostCommented ? [{
      type: 'CONVERSATION',
      icon: '⌁',
      tone: 'blue',
      title: `Prolonger la conversation autour de « ${mostCommented.title} »`,
      note: `${analysis.totalComments} commentaires mesurés sur la bibliothèque YouTube.`,
      confidence: 'Donnée réelle',
      action: 'Signal détecté',
      detail: 'Ce contenu concentre la conversation la plus active dans les données actuellement disponibles.',
      origin: 'derived' as const,
      proofLines,
    }] : []),
  ] : []

  const recommendations = persistedRecommendations.length ? persistedRecommendations : derivedRecommendations

  return (
    <div className="today today-live page-enter">
      <header className="minimal-head">
        <span>ANETO / PRIORITÉS</span>
        <div className="brain-status"><i></i>{memoryEvents.length} événement{memoryEvents.length > 1 ? 's' : ''} vérifiable{memoryEvents.length > 1 ? 's' : ''} dans l’historique</div>
      </header>
      <section className="home-brief">
        <p>Bonjour{firstName ? ` ${firstName}` : ''}.</p>
        <h1>Voici ce qui mérite<br /><em>une décision.</em></h1>
        <div className="home-brief-meta">
          <span>{analysis.count} contenus observés</span>
          <span>{transcriptCount} transcriptions exploitables</span>
          <span>{board.clips.length} cuts candidats</span>
        </div>
      </section>
      <section className="daily daily-first">
        <div className="daily-title">
          <p>PRIORITÉ ÉDITORIALE</p>
          <span>{recommendations.length ? `${recommendations.length} décision${recommendations.length > 1 ? 's' : ''}` : 'Preuves insuffisantes'}</span>
        </div>
        <Recommendations recommendations={recommendations} />
        <Link className="home-analysis-link" href="/intelligence">Voir le raisonnement et le niveau de preuve <Icon name="arrow" size={14} /></Link>
      </section>
      <SyncCommand
        sourceLabels={connectedSources.map((source) => providerLabel(source.provider))}
        connectedCount={connectedSources.length}
        latestSync={latestSync}
      />
      <SyncedLibrary items={library.slice(0, 8)} total={library.length} />
      <footer className="quiet-footer">
        <span>Chaque recommandation sépare faits, inférences et hypothèses.</span>
        <Link href="/memory">Voir l’historique <Icon name="arrow" size={14} /></Link>
      </footer>
    </div>
  )
}
