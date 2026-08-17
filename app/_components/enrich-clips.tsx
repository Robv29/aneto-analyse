'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Icon } from './icons'

type EnrichClipsProps = {
  aiClipCount: number
  pendingCount: number
}

export function EnrichClips({ aiClipCount, pendingCount }: EnrichClipsProps) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'success' | 'error' | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const enrich = async () => {
    setWorking(true)
    setMessage(null)
    setTone(null)
    try {
      const response = await fetch('/api/clips/enrich', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'OpenRouter n’a pas pu analyser les extraits.')
      setMessage(result.message)
      setTone('success')
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'OpenRouter n’a pas pu analyser les extraits.')
      setTone('error')
    } finally {
      setWorking(false)
    }
  }

  const busy = working || isRefreshing
  return (
    <section className={`ai-editorial ${busy ? 'is-working' : ''}`}>
      <div className="ai-editorial-mark"><Icon name="spark" size={20} /></div>
      <div>
        <small>COMITÉ ÉDITORIAL IA</small>
        <strong>{aiClipCount ? `${aiClipCount} finaliste${aiClipCount > 1 ? 's' : ''} challengé${aiClipCount > 1 ? 's' : ''}` : 'Mettre les passages en concurrence.'}</strong>
        <p>
          Une requête courte par vidéo, jusqu’à quatre en parallèle. Chaque analyse est
          historisée avec son modèle et sa version ; une vidéo en échec ne bloque pas les autres.
          {pendingCount ? ` ${pendingCount} vidéo${pendingCount > 1 ? 's' : ''} en attente d’analyse.` : ''}
        </p>
        {message ? <em className={tone === 'error' ? 'is-error' : ''} role="status">{message}</em> : null}
      </div>
      <button id="enrich-clips" type="button" onClick={enrich} disabled={busy || !pendingCount}>
        {busy ? 'Analyses courtes en cours…' : aiClipCount ? 'Analyser les vidéos suivantes' : 'Lancer les analyses courtes'}
        {' '}<Icon name={busy ? 'sync' : 'arrow'} size={15} />
      </button>
    </section>
  )
}
