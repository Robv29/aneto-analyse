'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <main className="system-state" role="alert">
          <span>ANETO / INDISPONIBLE</span>
          <h1>Le cerveau doit redémarrer.</h1>
          <button type="button" onClick={reset}>Redémarrer Aneto</button>
        </main>
      </body>
    </html>
  )
}
