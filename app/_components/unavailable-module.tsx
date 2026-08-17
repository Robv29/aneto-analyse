import Link from 'next/link'
import { Icon } from './icons'

export function UnavailableModule({ label, title, message }: { label: string; title: string; message: string }) {
  return (
    <div className="page page-enter unavailable-module">
      <header className="page-head">
        <div>
          <span>{label}</span>
          <h1>{title}</h1>
        </div>
      </header>
      <div className="module-empty">
        <strong>Données réelles requises.</strong>
        <p>{message}</p>
        <Link href="/settings">Voir les intégrations <Icon name="arrow" size={14} /></Link>
      </div>
    </div>
  )
}
