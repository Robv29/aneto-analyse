'use client'

import { useEffect, useState } from 'react'

export function AnetoClient() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    import('../../src/app.js').catch(() => {
      if (active) setFailed(true)
    })
    return () => { active = false }
  }, [])

  if (failed) {
    return (
      <main className="system-state" role="alert">
        <span>ANETO / ERREUR</span>
        <h1>L’application n’a pas pu démarrer.</h1>
        <p>Rechargez la page. Si le problème persiste, consultez l’état du service.</p>
        <button type="button" onClick={() => window.location.reload()}>Réessayer</button>
      </main>
    )
  }

  return <div id="root" aria-live="polite" />
}
