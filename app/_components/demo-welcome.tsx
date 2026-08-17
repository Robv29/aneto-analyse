import Link from 'next/link'
import { Icon } from './icons'

// Écran affiché lorsque Supabase n'est pas configuré : Aneto n'affiche plus de
// données fictives entrelacées avec le produit réel.
export function DemoWelcome() {
  return (
    <div className="page page-enter unavailable-module">
      <header className="page-head">
        <div>
          <span>ANETO / MODE DÉMONSTRATION</span>
          <h1>Le produit attend ses données.</h1>
        </div>
      </header>
      <div className="module-empty">
        <strong>Aucune donnée fictive n’est affichée.</strong>
        <p>
          Configure les variables Supabase dans Vercel puis connecte une première source
          (YouTube, TikTok ou Ausha) pour voir Aneto travailler sur tes contenus réels.
        </p>
        <Link href="/settings">Voir les intégrations <Icon name="arrow" size={14} /></Link>
      </div>
    </div>
  )
}
