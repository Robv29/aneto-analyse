import Link from 'next/link'
import { analyzeContent, editorialSignal, primaryMetric } from '@/src/analytics.mjs'
import { formatClipTime } from '@/src/clips.mjs'
import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getClipBoard, getDecisions, getLibrary, getMemoryEvents } from '@/lib/data/loaders'
import { ClipPreview } from '../../_components/clip-card'
import { CommitDecision } from '../../_components/commit-decision'
import { DemoWelcome } from '../../_components/demo-welcome'
import { compactNumber, contentHref, formatDuration, metricLabel } from '../../_components/format'
import { Icon } from '../../_components/icons'
import { SyncRetryButton } from '../../_components/sync-command'
import { UnavailableModule } from '../../_components/unavailable-module'

export const dynamic = 'force-dynamic'

export default async function IntelligencePage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [library, board, memoryEvents, decisions] = await Promise.all([
    getLibrary(workspace),
    getClipBoard(workspace),
    getMemoryEvents(workspace),
    getDecisions(workspace),
  ])
  const analysis = analyzeContent(library)
  if (!analysis.count) {
    return <UnavailableModule label="MEDIA DNA™" title="Intelligence" message="Synchronise une première source pour calculer les performances réelles." />
  }

  const transcriptCount = library.filter((item) => item.transcript?.status === 'available').length
  const timedTranscriptCount = library.filter((item) => item.hasClipCandidates).length
  const clips = board.clips
  const top = analysis.top
  const transcriptRatio = transcriptCount / analysis.count
  const leadDelta = analysis.averagePrimary ? Math.round(((primaryMetric(top) / analysis.averagePrimary) - 1) * 100) : 0
  const topicEvidence = editorialSignal(analysis.topics)
  const topic: string | null = topicEvidence?.label ?? null
  const topHref = contentHref(top)
  const maturity = transcriptCount === 0 ? 'bloqué' : transcriptRatio < .8 ? 'partiel' : analysis.count < 10 ? 'initial' : 'appris'

  const understanding = maturity === 'bloqué'
    ? 'Je vois ce qui marche. Je ne sais pas encore pourquoi.'
    : maturity === 'partiel'
      ? topic
        ? `Le terme « ${topic} » revient dans ${topicEvidence.count} contenus. Sa signification éditoriale reste à qualifier.`
        : 'Les textes deviennent exploitables, mais aucun sujet ne revient encore assez souvent pour constituer un signal.'
      : analysis.count < 10
        ? topic
          ? `Premier indice lexical : « ${topic} » revient dans ${topicEvidence.count} contenus, sans causalité démontrée.`
          : 'Aneto a identifié des passages forts, mais pas encore de récurrence éditoriale suffisamment démontrée.'
        : topic
          ? `« ${topic} » revient dans ${topicEvidence.count} contenus. Son lien avec la performance reste à tester.`
          : 'Les performances sont mesurées, mais aucun territoire éditorial récurrent ne domine encore.'

  const decision = maturity === 'bloqué'
    ? {
        label: 'ÉTAPE PRIORITAIRE',
        title: 'Donner à Aneto accès aux récits, émotions et passages forts.',
        rationale: `Les performances de ${analysis.count} contenus sont mesurées, mais aucune transcription n’est exploitable. Sans le texte, Aneto ne peut pas distinguer un sujet d’un hook ou d’une émotion.`,
        confidence: 'COMPRÉHENSION BLOQUÉE',
        href: '/settings',
        cta: 'Autoriser les transcriptions',
      }
    : clips.length ? {
        label: 'DÉRUSHAGE PRIORITAIRE',
        title: `Couper les ${Math.min(3, clips.length)} passages les plus prometteurs avant de produire davantage.`,
        rationale: `Aneto a retrouvé ${clips.length} passage${clips.length > 1 ? 's' : ''} minuté${clips.length > 1 ? 's' : ''}. Le premier démarre à ${formatClipTime(clips[0].start)} dans « ${clips[0].contentTitle} » et combine ${clips[0].reasons.join(', ') || 'une formulation autonome'}.`,
        confidence: 'PASSAGES VÉRIFIABLES',
        href: '/clips',
        cta: 'Ouvrir la table de montage',
      } : {
        label: 'DÉCISION PRIORITAIRE',
        title: `Réexaminer « ${top.title} » avant de produire un nouveau sujet.`,
        rationale: `Ce contenu dépasse la moyenne de ${Math.max(0, leadDelta)} %${topic ? ` ; le terme « ${topic} » revient dans ${topicEvidence.count} contenus, sans causalité démontrée` : ''}. Aneto recommande d’en extraire d’abord la mécanique éditoriale réutilisable.`,
        confidence: analysis.count < 10 ? 'SIGNAL INITIAL' : 'SIGNAL CONFIRMÉ',
        href: topHref ?? '/',
        cta: top.transcript?.status === 'available' ? 'Ouvrir la matière analysée' : 'Ouvrir le contenu source',
      }

  const currentDecision = maturity === 'bloqué' ? null : {
    title: decision.title,
    rationale: decision.rationale,
    contentItemId: clips[0]?.contentItemId ?? top.id ?? null,
  }

  const proofs = [
    { label: 'PERFORMANCE', value: `${compactNumber(primaryMetric(top))} ${metricLabel(top)}`, detail: leadDelta > 0 ? `+${leadDelta} % par rapport à la moyenne actuelle.` : 'Meilleur résultat de la bibliothèque actuelle.' },
    { label: 'RÉACTION', value: `${analysis.engagementRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`, detail: `${compactNumber(analysis.totalLikes + analysis.totalComments)} likes + commentaires ÷ ${compactNumber(analysis.totalViews)} vues sur les plateformes vidéo.` },
    { label: 'DÉRUSHAGE', value: `${clips.length}`, detail: clips.length ? `passages minutés dans ${timedTranscriptCount} vidéo${timedTranscriptCount > 1 ? 's' : ''}.` : transcriptCount ? 'Resynchronisation nécessaire pour récupérer les timecodes.' : 'Aucun récit, hook ou passage encore lisible.' },
  ]
  const hypotheses = [
    { label: 'TERME RÉCURRENT', value: topic ?? 'Non qualifié', state: topic ? `${topicEvidence.count} contenus · indice lexical, pas une cause de performance` : 'Aucune récurrence lexicale suffisamment solide' },
    { label: 'FORMAT OBSERVÉ', value: formatDuration(analysis.averageDurationSeconds), state: 'Durée moyenne, sans causalité démontrée' },
    { label: 'ANTI-SIGNAL', value: analysis.ranked.at(-1)?.title ?? 'À apprendre', state: 'À comparer après davantage de contenus' },
  ]
  const loop: Array<[string, string, string, string]> = [
    ['01', 'Comprendre', transcriptCount ? `${transcriptCount} transcription${transcriptCount > 1 ? 's' : ''} exploitable${transcriptCount > 1 ? 's' : ''}` : 'Autorisation requise', transcriptCount ? 'done' : 'blocked'],
    ['02', 'Décider', 'Une priorité, fondée sur les données disponibles', 'active'],
    ['03', 'Préparer', clips.length ? `${clips.length} extraits avec hooks et timecodes` : 'Hooks, extraits et textes après dérushage', clips.length ? 'done' : 'waiting'],
    ['04', 'Mesurer', 'Comparer la publication à sa référence', 'waiting'],
    ['05', 'Apprendre', `${memoryEvents.length + decisions.length} événement${memoryEvents.length + decisions.length > 1 ? 's' : ''} déjà mémorisé${memoryEvents.length + decisions.length > 1 ? 's' : ''}`, memoryEvents.length || decisions.length ? 'done' : 'waiting'],
  ]

  const maturityLabel = maturity === 'bloqué' ? 'Bloquée' : maturity === 'partiel' ? 'Partielle' : maturity === 'initial' ? 'Initiale' : 'En apprentissage'

  return (
    <div className="page intelligence intelligence-v2 page-enter">
      <header className="page-head intelligence-head">
        <div>
          <span>ANALYSES / RAISONNEMENT ÉDITORIAL</span>
          <h1>Ce que les données permettent de décider.</h1>
        </div>
        <div className={`learning intelligence-state ${maturity}`}>
          <i></i>
          <span>Qualité de la preuve<strong>{maturityLabel}</strong></span>
        </div>
      </header>
      <section className="understanding">
        <span>CONCLUSION ACTUELLE</span>
        <h2>{understanding}</h2>
        <p>{transcriptCount
          ? `${transcriptCount} transcription${transcriptCount > 1 ? 's' : ''} sur ${analysis.count} contenu${analysis.count > 1 ? 's' : ''} alimente${transcriptCount > 1 ? 'nt' : ''} cette lecture. Une conclusion reste provisoire tant que la couverture ou la répétition est faible.`
          : 'Les chiffres décrivent la performance. Les transcriptions permettront d’expliquer les sujets, les histoires, les émotions et les passages qui la provoquent.'}</p>
        <details className="evidence-guide">
          <summary>Comment Aneto qualifie une preuve</summary>
          <div>
            <span><b>FAIT</b> Valeur reçue d’une API ou citation exacte.</span>
            <span><b>INFÉRENCE</b> Relation calculée entre plusieurs faits.</span>
            <span><b>HYPOTHÈSE</b> Explication plausible qui doit être testée.</span>
          </div>
        </details>
      </section>
      <section className="decision-card">
        <div className="decision-number">01</div>
        <div className="decision-copy">
          <span>{decision.label}</span>
          <h2>{decision.title}</h2>
          <p>{decision.rationale}</p>
          <em>{decision.confidence}</em>
        </div>
        <div className="decision-actions">
          {decision.href.startsWith('http')
            ? <a href={decision.href} target="_blank" rel="noreferrer">{decision.cta} <Icon name="arrow" size={16} /></a>
            : <Link href={decision.href}>{decision.cta} <Icon name="arrow" size={16} /></Link>}
          {currentDecision ? <CommitDecision decision={currentDecision} /> : null}
        </div>
      </section>
      {clips.length ? <ClipPreview clips={clips.slice(0, 3)} /> : transcriptCount ? (
        <section className="clips-awaiting">
          <span><Icon name="clip" size={19} /></span>
          <div>
            <small>TIMECODES À RÉCUPÉRER</small>
            <strong>Les textes sont là. Aneto doit maintenant resynchroniser les pistes minutées.</strong>
          </div>
          <SyncRetryButton label="Relancer l’analyse" />
        </section>
      ) : null}
      <section className="proofs">
        <div className="section-label">
          <span>POURQUOI CETTE DÉCISION</span>
          <em>Faits observés · aucune prédiction inventée</em>
        </div>
        <div className="proof-grid">
          {proofs.map((proof, index) => (
            <article key={proof.label}>
              <small>0{index + 1} · {proof.label}</small>
              <strong>{proof.value}</strong>
              <p>{proof.detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="hypotheses">
        <div className="section-label">
          <span>MEDIA DNA EN APPRENTISSAGE</span>
          <em>Ce qui peut encore changer</em>
        </div>
        {hypotheses.map((item, index) => (
          <article key={item.label}>
            <span>0{index + 1}</span>
            <div><small>{item.label}</small><strong>{item.value}</strong></div>
            <p>{item.state}</p>
          </article>
        ))}
      </section>
      <section className="intelligence-loop">
        <div className="section-label">
          <span>LA BOUCLE DE VALEUR</span>
          <em>Aneto progresse seulement si le résultat revient dans la mémoire</em>
        </div>
        <div className="loop-grid">
          {loop.map(([num, title, detail, status]) => (
            <article key={num} className={status}>
              <span>{num}</span><i></i><strong>{title}</strong><small>{detail}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
