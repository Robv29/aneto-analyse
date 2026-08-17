import { primaryMetric } from '@/src/analytics.mjs'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getDecisions, getLibrary, getMemoryEvents, getSources } from '@/lib/data/loaders'
import { DemoWelcome } from '../../_components/demo-welcome'
import { compactNumber, providerLabel } from '../../_components/format'

export const dynamic = 'force-dynamic'

type TimelineEvent = {
  date: string
  title: string
  desc: string
  type: 'learn' | 'signal' | 'decision'
  label: string
}

export default async function MemoryPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [memoryEvents, sources, library, decisions] = await Promise.all([
    getMemoryEvents(workspace),
    getSources(workspace),
    getLibrary(workspace),
    getDecisions(workspace),
  ])

  const persistedEvents: TimelineEvent[] = memoryEvents.map((event) => ({
    date: event.observedAt,
    title: event.eventType,
    desc: `Source : ${event.source}`,
    type: 'learn',
    label: 'ÉVÉNEMENT MÉMORISÉ',
  }))
  const syncEvents: TimelineEvent[] = sources.filter((source) => source.lastSyncedAt).map((source) => ({
    date: source.lastSyncedAt!,
    title: `${providerLabel(source.provider)} synchronisé`,
    desc: `${library.filter((item) => item.provider === source.provider).length} contenus connus après cette synchronisation.`,
    type: 'signal',
    label: 'SYNCHRONISATION',
  }))
  const contentEvents: TimelineEvent[] = library.slice(0, 8).flatMap((item) => item.publishedAt ? [{
    date: item.publishedAt,
    title: item.title,
    desc: `${compactNumber(primaryMetric(item))} ${item.kind === 'video' ? 'vues' : 'écoutes'} · importé depuis ${providerLabel(item.provider)}${item.transcript?.status === 'available' ? ` · transcription de ${item.transcript.wordCount} mots` : ''}.`,
    type: 'learn' as const,
    label: item.transcript?.status === 'available' ? 'CONTENU TRANSCRIT' : 'CONTENU IMPORTÉ',
  }] : [])

  const events = [...persistedEvents, ...syncEvents, ...contentEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12)

  return (
    <div className="page memory-page page-enter">
      <header className="page-head">
        <div>
          <span>HISTORIQUE / DÉCISIONS &amp; ÉVÉNEMENTS</span>
          <h1>Historique</h1>
        </div>
        <div className="memory-count"><strong>{events.length}</strong><span>événements<br />chargés</span></div>
      </header>
      <section className="memory-summary">
        <p>Aneto se souvient de chaque décision et de ce qui s’est passé ensuite.</p>
        <div>
          <span>Décisions mémorisées<strong>{decisions.length}</strong></span>
          <span>Contenus connus<strong>{library.length}</strong></span>
          <span>Sources actives<strong>{sources.filter((source) => source.state === 'connected').length}</strong></span>
        </div>
      </section>
      <section className="timeline">
        <div className="timeline-line"></div>
        {events.length ? events.map((event, index) => (
          <article key={`${event.date}-${index}`} className="memory-event">
            <div className="memory-date">{new Date(event.date).toLocaleDateString('fr-FR')}</div>
            <i className={event.type}></i>
            <div>
              <span>{event.label}</span>
              <h3>{event.title}</h3>
              <p>{event.desc}</p>
            </div>
          </article>
        )) : (
          <div className="module-empty">
            <strong>La mémoire est vide.</strong>
            <p>Le premier événement sera créé par une synchronisation ou une décision humaine.</p>
          </div>
        )}
      </section>
    </div>
  )
}
