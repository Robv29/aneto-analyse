import Link from 'next/link'
import { analyzeContent, primaryMetric } from '@/src/analytics.mjs'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getLibrary, getSources } from '@/lib/data/loaders'
import { DemoWelcome } from '../../_components/demo-welcome'
import { compactNumber, metricLabel } from '../../_components/format'
import { Icon } from '../../_components/icons'
import { UnavailableModule } from '../../_components/unavailable-module'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [library, sources] = await Promise.all([getLibrary(workspace), getSources(workspace)])
  const analysis = analyzeContent(library)
  if (!analysis.count) {
    return <UnavailableModule label="RESEARCH / SIGNAUX" title="Les contenus parleront." message="Synchronise une première source pour faire émerger des opportunités réelles." />
  }

  const rankedComments = [...analysis.ranked].sort((a: (typeof analysis.ranked)[number], b: (typeof analysis.ranked)[number]) =>
    (Number(b.payload?.commentCount) || 0) - (Number(a.payload?.commentCount) || 0))
  const ops: Array<[string, string, string, string]> = [
    ['01', `Capitaliser sur « ${analysis.top.title} »`, 'Performance', `${compactNumber(primaryMetric(analysis.top))} ${metricLabel(analysis.top)}`] as [string, string, string, string],
    ...(analysis.totalComments ? [['02', `Prolonger la conversation sur « ${rankedComments[0].title} »`, 'Conversation', `${compactNumber(rankedComments[0].payload?.commentCount)} commentaires`] as [string, string, string, string]] : []),
    ...(analysis.topics[0] ? [['03', `Explorer davantage le sujet « ${analysis.topics[0].label} »`, 'Sujet', `${analysis.topics[0].count} contenus`] as [string, string, string, string]] : []),
    ...analysis.ranked.slice(1, 3).map((item: (typeof analysis.ranked)[number], index: number) =>
      [String(index + 4).padStart(2, '0'), `Comparer le potentiel de « ${item.title} »`, 'Bibliothèque', `${compactNumber(primaryMetric(item))} ${metricLabel(item)}`] as [string, string, string, string]),
  ].slice(0, 5)

  const connectedSources = sources.filter((source) => source.state === 'connected')
  const activeProviders = [...new Set(connectedSources.map((source) => source.provider.toUpperCase()))]

  return (
    <div className="page research-page page-enter">
      <header className="page-head">
        <div>
          <span>RESEARCH / SIGNAUX INTERNES</span>
          <h1>Tes contenus parlent.<br />Aneto compare.</h1>
        </div>
        <div className="scan-orbit">
          <i></i>
          <span>
            {connectedSources.length} source{connectedSources.length > 1 ? 's' : ''} active{connectedSources.length > 1 ? 's' : ''}
            <small>{analysis.count} contenus analysés</small>
          </span>
        </div>
      </header>
      <section className="scan-sources">
        {activeProviders.map((provider) => <span key={provider}>{provider}</span>)}
        <em>Données issues de la dernière synchronisation</em>
      </section>
      <section className="opportunities">
        <div className="section-label">
          <span>OPPORTUNITÉS DÉTECTÉES</span>
          <em>Classées par signal mesuré</em>
        </div>
        {ops.map(([num, title, type, score]) => (
          <Link key={num} className="opportunity signal-arrival" href="/">
            <span>{num}</span>
            <strong>{title}</strong>
            <em>{type}</em>
            <b>{score}</b>
            <Icon name="arrow" size={16} />
          </Link>
        ))}
      </section>
      <section className="research-note">
        <span><Icon name="brain" size={18} /></span>
        <p>Ces signaux utilisent uniquement les performances synchronisées. <strong>La veille externe n’est pas encore activée.</strong></p>
      </section>
    </div>
  )
}
