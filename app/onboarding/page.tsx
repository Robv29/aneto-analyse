import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/data/session'
import { createOrganization } from './actions'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await getSessionContext()
  const { error } = await searchParams
  if (session.mode === 'demo' || !session.viewer) redirect('/login')
  if (session.organization) redirect('/')

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span>ANETO / PREMIER ESPACE</span>
        <h1>Donne un nom à la mémoire de ton média.</h1>
        <p>Les données et les décisions de chaque organisation resteront isolées.</p>
        <form action={createOrganization} className="auth-form">
          <label>
            Nom de l’organisation
            <input name="name" type="text" placeholder="Aneto Media" minLength={2} required />
          </label>
          <label>
            Identifiant
            <input name="slug" type="text" placeholder="aneto-media" minLength={2} required />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit">Créer mon espace</button>
        </form>
      </section>
    </main>
  )
}
