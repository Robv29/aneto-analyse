'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Icon } from './icons'

export function AnalyzePatterns({ hasInsights }: { hasInsights: boolean }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'success' | 'error' | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const analyze = async () => {
    setWorking(true)
    setMessage(null)
    setTone(null)
    try {
      const response = await fetch('/api/patterns/analyze', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'L’analyse n’a pas abouti.')
      setMessage(result.message)
      setTone('success')
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'L’analyse n’a pas abouti.')
      setTone('error')
    } finally {
      setWorking(false)
    }
  }

  const busy = working || isRefreshing
  return (
    <div className="dash-syncbar">
      <button type="button" onClick={analyze} disabled={busy}>
        <Icon name={busy ? 'sync' : 'spark'} size={14} />
        {busy ? 'Analyse en cours…' : hasInsights ? 'Mettre à jour la lecture IA' : 'Lancer la lecture IA'}
      </button>
      {message ? <span className={`dash-sync-status ${tone === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</span> : null}
    </div>
  )
}
