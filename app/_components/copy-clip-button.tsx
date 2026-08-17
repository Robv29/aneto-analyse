'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Icon } from './icons'

type CopyClipButtonProps = {
  text: string
  clip?: { contentItemId: string; candidateKey: string }
}

// Après la copie du kit, demande si le short a été publié : un short publié
// est marqué en base, disparaît des propositions et n'est jamais reproposé.
export function CopyClipButton({ text, clip }: CopyClipButtonProps) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'copied' | 'asking' | 'marking' | 'published' | 'error'>('idle')
  const timer = useRef<number | null>(null)
  const [, startTransition] = useTransition()

  const scheduleReset = (delay: number) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), delay)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      if (clip) {
        setState('asking')
      } else {
        setState('copied')
        scheduleReset(1800)
      }
    } catch {
      setState('error')
      scheduleReset(2500)
    }
  }

  const markPublished = async () => {
    if (!clip) return
    setState('marking')
    try {
      const response = await fetch('/api/clips/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: clip.contentItemId, candidateKey: clip.candidateKey, status: 'published' }),
      })
      if (!response.ok) throw new Error()
      setState('published')
      startTransition(() => router.refresh())
    } catch {
      setState('error')
      scheduleReset(2500)
    }
  }

  if (state === 'asking' || state === 'marking') {
    return (
      <span className="copy-clip-ask" role="status">
        <em>Copié · Publié ?</em>
        <button type="button" className="copy-clip is-confirm" onClick={markPublished} disabled={state === 'marking'}>
          {state === 'marking' ? '…' : 'Oui, publié'}
        </button>
        <button type="button" className="copy-clip" onClick={() => { setState('idle') }} disabled={state === 'marking'}>
          Pas encore
        </button>
      </span>
    )
  }

  return (
    <button type="button" className="copy-clip" onClick={copy}>
      {state === 'published'
        ? <><Icon name="check" size={14} /> Publié</>
        : state === 'copied'
          ? <><Icon name="check" size={14} /> Copié</>
          : state === 'error'
            ? 'Action impossible, réessaie'
            : <><Icon name="copy" size={14} /> Copier texte + #</>}
    </button>
  )
}
