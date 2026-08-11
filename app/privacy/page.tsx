import Link from 'next/link'

export const metadata = { title: 'Confidentialité — Aneto' }

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header>
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <div><span>ANETO / LÉGAL</span><h1>Politique de confidentialité</h1></div>
      </header>
      <article>
        <p className="legal-date">Dernière mise à jour : 11 août 2026</p>
        <h2>Ce qu’Aneto collecte</h2>
        <p>Aneto traite les informations de compte nécessaires à la connexion, ainsi que les contenus publics, légendes et statistiques que tu autorises explicitement depuis YouTube, TikTok ou une autre source connectée. Les jetons d’accès sont chiffrés et ne sont jamais affichés dans le produit.</p>
        <h2>Pourquoi ces données sont utilisées</h2>
        <p>Ces données servent uniquement à synchroniser ta bibliothèque, mesurer les performances et produire des analyses éditoriales dans ton espace Aneto. Aneto ne publie, ne modifie et ne supprime aucun contenu sur tes plateformes.</p>
        <h2>Partage et conservation</h2>
        <p>Aneto ne vend pas tes données. Elles sont hébergées par les prestataires techniques indispensables au fonctionnement du service et conservées tant que la source reste connectée ou que la loi l’exige.</p>
        <h2>Tes choix</h2>
        <p>Tu peux révoquer l’accès depuis la plateforme concernée. Pour demander l’accès, la rectification ou la suppression de tes données, écris à <a href="mailto:aneto.media@gmail.com">aneto.media@gmail.com</a>.</p>
        <nav><Link href="/terms">Conditions d’utilisation</Link><Link href="/">Retour à Aneto</Link></nav>
      </article>
    </main>
  )
}
