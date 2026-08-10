import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="system-state">
      <span>ANETO / 404</span>
      <h1>Cette connaissance n’existe pas encore.</h1>
      <Link href="/">Revenir à aujourd’hui</Link>
    </main>
  )
}
