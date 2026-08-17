'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type CommitDecisionProps = {
  decision: { title: string; rationale: string; contentItemId: string | null }
}

export function CommitDecision({ decision }: CommitDecisionProps) {
  const router = useRouter()
  const [committing, setCommitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const commit = async () => {
    setCommitting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'La décision n’a pas pu être mémorisée.')
      setMessage(result.message)
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La décision n’a pas pu être mémorisée.')
    } finally {
      setCommitting(false)
    }
  }

  const busy = committing || isRefreshing
  return (
    <>
      <button id="commit-decision" type="button" onClick={commit} disabled={busy}>
        {busy ? 'Mémorisation…' : 'Retenir cette décision'}
      </button>
      {message ? <div className="decision-feedback" role="status">{message}</div> : null}
    </>
  )
}
