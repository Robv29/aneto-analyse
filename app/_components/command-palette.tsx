'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './icons'

const entries: Array<{ path: string; label: string; group: string }> = [
  { path: '/', label: 'Aujourd’hui', group: 'PILOTER' },
  { path: '/patterns', label: 'Patterns — ce qui marche', group: 'PILOTER' },
  { path: '/clips', label: 'Shorts', group: 'PRODUIRE' },
  { path: '/library', label: 'Contenus', group: 'PRODUIRE' },
  { path: '/memory', label: 'Historique', group: 'SUIVRE' },
  { path: '/settings', label: 'Paramètres', group: 'ADMINISTRER' },
]

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr-FR')
    if (!needle) return entries
    return entries.filter((entry) =>
      entry.label.toLocaleLowerCase('fr-FR').includes(needle) || entry.group.toLocaleLowerCase('fr-FR').includes(needle))
  }, [query])

  const open = (path: string) => {
    onClose()
    router.push(path)
  }

  return (
    <div className="command-wrap" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="command" role="dialog" aria-modal="true" aria-label="Recherche et commandes">
        <div className="command-input">
          <Icon name="spark" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && filtered[0]) open(filtered[0].path) }}
            placeholder="Décider, comprendre ou retrouver…"
          />
          <kbd>ESC</kbd>
        </div>
        <p>NAVIGATION CLASSÉE</p>
        {filtered.map((entry) => (
          <button key={entry.path} type="button" onClick={() => open(entry.path)}>
            <span><small>{entry.group}</small>{entry.label}</span>
            <Icon name="arrow" size={15} />
          </button>
        ))}
        <footer><span>Décider · Comprendre · Administrer</span><span>↵ Ouvrir</span></footer>
      </div>
    </div>
  )
}
