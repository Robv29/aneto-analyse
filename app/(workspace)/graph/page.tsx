import { analyzeContent, primaryMetric } from '@/src/analytics.mjs'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getLibrary } from '@/lib/data/loaders'
import { DemoWelcome } from '../../_components/demo-welcome'
import { compactNumber } from '../../_components/format'
import { GraphStage, type GraphNode } from '../../_components/graph-stage'
import { Icon } from '../../_components/icons'
import { UnavailableModule } from '../../_components/unavailable-module'

export const dynamic = 'force-dynamic'

const positions: Array<[number, number]> = [[23, 22], [72, 18], [84, 45], [75, 76], [27, 78], [14, 48], [49, 86], [50, 12]]

export default async function GraphPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const library = await getLibrary(workspace)
  const analysis = analyzeContent(library)
  if (!analysis.count) {
    return <UnavailableModule label="CONNAISSANCES" title="Tout sera relié." message="Synchronise une première source pour créer le graphe réel." />
  }

  const nodes: GraphNode[] = [
    {
      id: 'workspace',
      label: workspace.organization.name,
      x: 50,
      y: 48,
      r: 42,
      kind: 'person',
      score: `${analysis.count}`,
      connections: analysis.count + analysis.topics.length,
      desc: `Espace relié à ${analysis.count} contenus synchronisés et ${analysis.topics.length} sujets détectés.`,
      url: null,
    },
    ...analysis.ranked.slice(0, 5).map((item: (typeof analysis.ranked)[number], index: number) => ({
      id: item.id,
      label: item.title.length > 22 ? `${item.title.slice(0, 20)}…` : item.title,
      x: positions[index][0],
      y: positions[index][1],
      r: Math.min(34, 22 + Math.round((primaryMetric(item) / (primaryMetric(analysis.top) || 1)) * 12)),
      kind: 'content',
      score: compactNumber(primaryMetric(item)),
      connections: 1,
      desc: `${item.title} · ${compactNumber(primaryMetric(item))} ${item.kind === 'video' ? 'vues' : 'écoutes'}.`,
      url: item.provider === 'youtube' ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.externalId)}` : null,
    })),
    ...analysis.topics.slice(0, 3).map((topic: (typeof analysis.topics)[number], index: number) => ({
      id: `topic-${index}`,
      label: topic.label,
      x: positions[index + 5][0],
      y: positions[index + 5][1],
      r: 20 + topic.count * 2,
      kind: 'topic',
      score: `${topic.count}×`,
      connections: topic.count,
      desc: `Sujet présent dans ${topic.count} contenu${topic.count > 1 ? 's' : ''} synchronisé${topic.count > 1 ? 's' : ''}.`,
      url: null,
    })),
  ]

  return (
    <div className="page graph-page page-enter">
      <header className="page-head graph-head">
        <div>
          <span>CONNAISSANCES / {nodes.length - 1} CONNEXIONS RÉELLES</span>
          <h1>Tout est relié.</h1>
        </div>
        <button type="button" className="graph-search" disabled>
          <Icon name="search" size={16} /> Explorer une connaissance <kbd>⌘ F</kbd>
        </button>
      </header>
      <GraphStage nodes={nodes} workspaceLabel="Espace" />
    </div>
  )
}
