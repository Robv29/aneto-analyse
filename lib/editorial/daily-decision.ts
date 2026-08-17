import { editorialSignal, primaryMetric } from '@/src/analytics.mjs'
import { formatClipTime } from '@/src/clips.mjs'
import type { BoardClip, LibraryItem } from '@/lib/data/loaders'

type Analysis = {
  count: number
  top: LibraryItem
  ranked: LibraryItem[]
  averagePrimary: number
  totalViews: number
  totalLikes: number
  totalComments: number
  engagementRate: number
  topics: Array<{ label: string; count: number }>
}

export type DailyDecision = {
  label: string
  title: string
  rationale: string
  confidence: string
  href: string
  cta: string
  commit: null | { title: string; rationale: string; contentItemId: string | null }
  proofs: Array<{ label: string; text: string }>
}

const compact = (value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

// L'action recommandée du jour, avec ses preuves. Pur : aucune requête.
export function buildDailyDecision(analysis: Analysis, clips: BoardClip[], transcriptCount: number): DailyDecision {
  const top = analysis.top
  const leadDelta = analysis.averagePrimary ? Math.round(((primaryMetric(top) / analysis.averagePrimary) - 1) * 100) : 0
  const topicEvidence = editorialSignal(analysis.topics) as { label: string; count: number } | null
  const metric = top.kind === 'video' ? 'vues' : 'écoutes'

  const proofs: Array<{ label: string; text: string }> = [
    {
      label: 'PERFORMANCE',
      text: `« ${top.title} » cumule ${compact(primaryMetric(top))} ${metric}${leadDelta > 0 ? `, soit +${leadDelta} % au-dessus de la moyenne de la bibliothèque` : ''}.`,
    },
    {
      label: 'RÉACTION',
      text: `${compact(analysis.totalLikes + analysis.totalComments)} réactions pour ${compact(analysis.totalViews)} vues (${analysis.engagementRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % d'engagement).`,
    },
    clips.length
      ? { label: 'DÉRUSHAGE', text: `${clips.length} passage${clips.length > 1 ? 's' : ''} minuté${clips.length > 1 ? 's' : ''} déjà identifié${clips.length > 1 ? 's' : ''}, prêt${clips.length > 1 ? 's' : ''} à couper.` }
      : { label: 'DÉRUSHAGE', text: transcriptCount ? 'Transcriptions présentes ; les timecodes arrivent à la prochaine synchronisation.' : 'Aucune transcription lisible pour le moment.' },
    ...(topicEvidence ? [{
      label: 'RÉCURRENCE',
      text: `Le terme « ${topicEvidence.label} » revient dans ${topicEvidence.count} contenus — indice lexical à tester, pas une cause démontrée.`,
    }] : []),
  ]

  if (transcriptCount === 0) {
    return {
      label: 'ÉTAPE PRIORITAIRE',
      title: 'Autoriser les transcriptions pour débloquer l’analyse.',
      rationale: `Les performances de ${analysis.count} contenus sont mesurées, mais sans le texte Aneto ne peut pas identifier les passages qui les provoquent.`,
      confidence: 'COMPRÉHENSION BLOQUÉE',
      href: '/settings',
      cta: 'Ouvrir les paramètres',
      commit: null,
      proofs,
    }
  }

  if (clips.length) {
    const best = clips[0]
    const decision = {
      title: `Couper et publier « ${best.title} »`,
      rationale: `Le passage démarre à ${formatClipTime(best.start)} dans « ${best.contentTitle} » (${best.duration} s) et combine ${best.reasons.join(', ') || 'une formulation autonome'}. C'est le cut le mieux noté de la bibliothèque (${best.score}/100).`,
    }
    return {
      label: 'SHORT PRIORITAIRE',
      ...decision,
      confidence: 'PASSAGE VÉRIFIABLE',
      href: '/clips',
      cta: 'Ouvrir les shorts',
      commit: { ...decision, contentItemId: best.contentItemId },
      proofs,
    }
  }

  const decision = {
    title: `Réexaminer « ${top.title} » avant de produire un nouveau sujet.`,
    rationale: `Ce contenu dépasse la moyenne de ${Math.max(0, leadDelta)} %. Aneto recommande d'en extraire la mécanique éditoriale réutilisable avant d'investir ailleurs.`,
  }
  return {
    label: 'DÉCISION PRIORITAIRE',
    ...decision,
    confidence: analysis.count < 10 ? 'SIGNAL INITIAL' : 'SIGNAL CONFIRMÉ',
    href: top.transcript?.status === 'available' ? `/transcripts/${encodeURIComponent(top.id)}` : '/library',
    cta: top.transcript?.status === 'available' ? 'Ouvrir la transcription' : 'Ouvrir la bibliothèque',
    commit: { ...decision, contentItemId: top.id },
    proofs,
  }
}
