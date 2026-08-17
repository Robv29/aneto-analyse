'use client'

import { useRef, useState } from 'react'
import { Icon } from './icons'

export function CopyClipButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<number | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  return (
    <button type="button" className="copy-clip" onClick={copy}>
      {state === 'copied'
        ? <><Icon name="check" size={14} /> Copié</>
        : state === 'error'
          ? 'Copie bloquée par le navigateur'
          : <><Icon name="copy" size={14} /> Copier texte + #</>}
    </button>
  )
}
