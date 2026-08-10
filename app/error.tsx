'use client'

export default function ErrorState({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <main className="system-state" role="alert">
      <span>ANETO / INCIDENT</span>
      <h1>Quelque chose m’empêche de continuer.</h1>
      <p>L’incident a été isolé. Vous pouvez relancer cette vue sans perdre votre travail.</p>
      <button type="button" onClick={reset}>Relancer</button>
    </main>
  )
}
