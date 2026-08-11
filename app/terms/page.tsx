import Link from 'next/link'

export const metadata = { title: 'Conditions d’utilisation — Aneto' }

export default function TermsPage() {
  return (
    <main className="legal-page">
      <header>
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <div><span>ANETO / LÉGAL</span><h1>Conditions d’utilisation</h1></div>
      </header>
      <article>
        <p className="legal-date">Dernière mise à jour : 11 août 2026</p>
        <h2>Objet du service</h2>
        <p>Aneto est un outil d’analyse éditoriale en lecture seule. Il centralise les contenus et statistiques des comptes que tu choisis de connecter afin d’aider à comprendre les performances et préparer de futurs contenus.</p>
        <h2>Connexion aux plateformes</h2>
        <p>Tu dois être autorisé à connecter les comptes concernés. L’accès peut être interrompu ou révoqué à tout moment depuis la plateforme source. Aneto respecte les limites et disponibilités des API tierces.</p>
        <h2>Utilisation responsable</h2>
        <p>Les recommandations sont des aides à la décision. Tu restes responsable de la vérification des informations et de toute publication réalisée en dehors d’Aneto. Aucun contenu n’est publié automatiquement.</p>
        <h2>Disponibilité et contact</h2>
        <p>Le service peut évoluer ou être temporairement indisponible. Pour toute question ou demande relative au compte, écris à <a href="mailto:aneto.media@gmail.com">aneto.media@gmail.com</a>.</p>
        <nav><Link href="/privacy">Politique de confidentialité</Link><Link href="/">Retour à Aneto</Link></nav>
      </article>
    </main>
  )
}
