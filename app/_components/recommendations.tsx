'use client'

import { useState } from 'react'
import { Icon } from './icons'

export type Recommendation = {
  type: string
  icon: string
  tone: string
  title: string
  note: string
  confidence: string
  action: string
  detail: string
  origin: 'persisted' | 'derived'
  proofLines: string[]
}

export function Recommendations({ recommendations }: { recommendations: Recommendation[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const selected = openIndex === null ? null : recommendations[openIndex]

  if (!recommendations.length) {
    return (
      <div className="module-empty">
        <strong>Aucune décision pour le moment.</strong>
        <p>Les recommandations apparaîtront après la première synchronisation.</p>
      </div>
    )
  }

  return (
    <>
      <div className="recommendations">
        {recommendations.map((recommendation, index) => (
          <button key={`${recommendation.title}-${index}`} type="button" className="rec" onClick={() => setOpenIndex(index)}>
            <span className={`rec-icon ${recommendation.tone}`}>{recommendation.icon}</span>
            <span className="rec-copy">
              <small>{recommendation.type}</small>
              <strong>{recommendation.title}</strong>
              <em>{recommendation.note}</em>
            </span>
            <span className="rec-ready">{recommendation.action}</span>
            <Icon name="arrow" size={17} />
          </button>
        ))}
      </div>
      {selected ? (
        <>
          <div className="scrim" onClick={() => setOpenIndex(null)} />
          <aside className="drawer page-enter" role="dialog" aria-modal="true" aria-label="Détail de la décision">
            <button type="button" className="close" onClick={() => setOpenIndex(null)} aria-label="Fermer"><Icon name="close" /></button>
            <span className="drawer-label">{selected.type} · {selected.confidence}</span>
            <h2>{selected.title}</h2>
            <p>{selected.detail}</p>
            {selected.origin === 'persisted' ? (
              <div className="prepared-block">
                <div><span>MÉMOIRE</span><strong>Cette décision est enregistrée dans la mémoire d’Aneto.</strong></div>
              </div>
            ) : (
              <>
                <div className="prepared-block">
                  <div><span>CALCUL SUR DONNÉES RÉELLES</span><strong>{selected.action}</strong></div>
                  <Icon name="check" size={18} />
                </div>
                <div className="reason-list">
                  <span>CE QUI A ÉTÉ CROISÉ</span>
                  {selected.proofLines.map((line) => <p key={line}><i></i>{line}</p>)}
                </div>
              </>
            )}
            <button type="button" className="secondary" onClick={() => setOpenIndex(null)}>Fermer</button>
          </aside>
        </>
      ) : null}
    </>
  )
}
