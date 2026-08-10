import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getWorkspaceSnapshot } from '@/lib/data/workspace'
import { signOut } from '@/app/login/actions'
import { connectAusha, enqueueAushaSync } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const snapshot = await getWorkspaceSnapshot()
  const feedback = await searchParams
  if (snapshot.mode === 'live' && !snapshot.viewer) redirect('/login')
  const ausha = snapshot.sources.find((source) => source.provider === 'ausha')
  const aushaReady = snapshot.connectors.find((connector) => connector.key === 'ausha')?.configured

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

      {feedback.error ? <p className="settings-feedback is-error" role="alert">{feedback.error}</p> : null}
      {feedback.success ? <p className="settings-feedback is-success" role="status">{feedback.success}</p> : null}

      <section className="settings-section">
        <div>
          <span>ENVIRONNEMENT</span>
          <h2>{snapshot.mode === 'live' ? 'Espace connecté' : 'Mode démonstration'}</h2>
        </div>
        <p>{snapshot.mode === 'live'
          ? `${snapshot.viewer?.displayName ?? snapshot.viewer?.email} · rôle ${snapshot.organization?.role ?? 'sans organisation'}`
          : 'Aucune donnée affichée dans le produit n’est encore issue d’un compte client.'}</p>
      </section>

      {snapshot.mode === 'live' && aushaReady ? (
        <section className="settings-section connector-control">
          <div>
            <span>AUSHA / PUBLIC API</span>
            <h2>{ausha ? 'Émission connectée' : 'Connecter une émission'}</h2>
          </div>
          {ausha ? (
            <div>
              <p>Dernière synchronisation : {ausha.lastSyncedAt ? new Date(ausha.lastSyncedAt).toLocaleString('fr-FR') : 'jamais'}</p>
              <form action={enqueueAushaSync}>
                <input type="hidden" name="sourceId" value={ausha.id} />
                <button type="submit">Programmer une synchronisation</button>
              </form>
            </div>
          ) : (
            <form action={connectAusha} className="auth-form">
              <label>
                Identifiant de l’émission
                <input name="showId" inputMode="numeric" pattern="[0-9]+" required />
              </label>
              <label>
                Jeton Public API Ausha
                <input name="accessToken" type="password" autoComplete="off" minLength={20} required />
              </label>
              <small>Le jeton est vérifié auprès d’Ausha puis stocké sous forme chiffrée.</small>
              <button type="submit">Vérifier et connecter</button>
            </form>
          )}
        </section>
      ) : null}

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
