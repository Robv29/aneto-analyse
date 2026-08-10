import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getWorkspaceSnapshot } from '@/lib/data/workspace'
import { signOut } from '@/app/login/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const snapshot = await getWorkspaceSnapshot()
  if (snapshot.mode === 'live' && !snapshot.viewer) redirect('/login')

  return (
    <main className="settings-page">
      <header>
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <div>
          <span>ANETO / PARAMÈTRES</span>
          <h1>{snapshot.organization?.name ?? 'Démonstration'}</h1>
        </div>
        <Link href="/">Retour au produit</Link>
      </header>

      <section className="settings-section">
        <div>
          <span>ENVIRONNEMENT</span>
          <h2>{snapshot.mode === 'live' ? 'Espace connecté' : 'Mode démonstration'}</h2>
        </div>
        <p>{snapshot.mode === 'live'
          ? `${snapshot.viewer?.displayName ?? snapshot.viewer?.email} · rôle ${snapshot.organization?.role ?? 'sans organisation'}`
          : 'Aucune donnée affichée dans le produit n’est encore issue d’un compte client.'}</p>
      </section>

      <section className="settings-section integrations-list">
        <div>
          <span>INTÉGRATIONS</span>
          <h2>Sources disponibles</h2>
        </div>
        <div>
          {snapshot.connectors.map((connector) => {
            const source = snapshot.sources.find((item) => item.provider === connector.key)
            const state = source?.state ?? (connector.configured ? 'Prêt à connecter' : 'Non configuré')
            return (
              <article key={connector.key}>
                <strong>{connector.label}</strong>
                <span className={source?.state === 'connected' ? 'is-connected' : ''}>{state}</span>
              </article>
            )
          })}
        </div>
      </section>

      {snapshot.mode === 'live' ? (
        <form action={signOut} className="signout-form">
          <button type="submit">Se déconnecter</button>
        </form>
      ) : null}
    </main>
  )
}
