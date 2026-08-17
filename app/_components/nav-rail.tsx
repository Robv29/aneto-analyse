'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from './icons'
import { CommandPalette } from './command-palette'

const navGroups: Array<{ label: string; items: Array<[string, string, string]> }> = [
  { label: 'PILOTER', items: [['/', 'home', 'Aujourd’hui']] },
  { label: 'PRODUIRE', items: [['/clips', 'clip', 'Shorts'], ['/library', 'memory', 'Contenus']] },
  { label: 'SUIVRE', items: [['/memory', 'brain', 'Historique']] },
]

const shortcuts: Record<string, string> = {
  a: '/',
  s: '/clips',
  c: '/library',
  h: '/memory',
}

export function NavRail({ identity, initials }: { identity: string; initials: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        return
      }
      const target = document.activeElement?.tagName
      if (!event.metaKey && !event.ctrlKey && !event.altKey && target !== 'INPUT' && target !== 'TEXTAREA') {
        const path = shortcuts[event.key.toLowerCase()]
        if (path) router.push(path)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  return (
    <aside className="rail">
      <Link href="/" className="logo" aria-label="Aneto">A</Link>
      <nav aria-label="Navigation principale">
        {navGroups.map((group) => (
          <section key={group.label} className="rail-section">
            <span className="rail-section-label">{group.label}</span>
            {group.items.map(([href, icon, label]) => (
              <Link
                key={href}
                href={href}
                className={`rail-button ${pathname === href ? 'active' : ''}`}
                aria-label={`${group.label} · ${label}`}
              >
                <Icon name={icon} />
                <span><b>{label}</b><small>{group.label.toLowerCase()}</small></span>
              </Link>
            ))}
          </section>
        ))}
      </nav>
      <div className="rail-bottom">
        <button type="button" className="rail-button" id="global-search" aria-label="Commander et rechercher" onClick={openPalette}>
          <Icon name="search" />
          <span><b>Commander</b><small>⌘ K</small></span>
        </button>
        <Link className="rail-settings" href="/settings" aria-label={`Réglages · ${identity}`}>
          <span className="avatar">{initials}</span>
          <span><b>Réglages</b><small>Système</small></span>
        </Link>
      </div>
      {paletteOpen ? <CommandPalette onClose={closePalette} /> : null}
    </aside>
  )
}
