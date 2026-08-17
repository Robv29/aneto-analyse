'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Icon } from './icons'

// Demande 5 nouveaux shorts sur la dernière vidéo YouTube. Les passages déjà
// proposés (publiés ou non) sont exclus côté serveur : jamais de doublon.
export function MoreShorts({ latestVideoTitle }: { latestVideoTitle: string | null }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'success' | 'error' | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const requestShorts = async () => {
    setWorking(true)
    setMessage(null)
    setTone(null)
    try {
      const response = await fetch('/api/clips/more', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Les nouveaux shorts n’ont pas pu être générés.')
      setMessage(result.message)
      setTone('success')
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Les nouveaux shorts n’ont pas pu être générés.')
      setTone('error')
    } finally {
      setWorking(false)
    }
  }

  const busy = working || isRefreshing
  return (
    <section className="more-shorts">
      <div className="more-shorts-copy">
        <strong>Besoin de nouveaux shorts ?</strong>
        <span>
          5 nouveaux passages de {latestVideoTitle ? `« ${latestVideoTitle} »` : 'ta dernière vidéo YouTube'},
          jamais proposés auparavant, avec leur kit de publication.
        </span>
      </div>
      <button type="button" onClick={requestShorts} disabled={busy}>
        <Icon name={busy ? 'sync' : 'spark'} size={14} />
        {busy ? 'Génération en cours…' : '5 nouveaux shorts'}
      </button>
      {message ? <span className={`more-shorts-status ${tone === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</span> : null}
    </section>
  )
}
