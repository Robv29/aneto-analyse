import Link from 'next/link'
import { redirect } from 'next/navigation'
import { hasSupabaseConfig } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signIn } from './actions'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const configured = hasSupabaseConfig()
  const supabase = await createSupabaseServerClient()
  const user = supabase ? (await supabase.auth.getUser()).data.user : null
  if (user) redirect('/')

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <span>ANETO / ACCÈS PRIVÉ</span>
        <h1>Retrouve la mémoire de ton média.</h1>
        {!configured ? (
          <div className="auth-notice" role="status">
            <strong>Mode démonstration actif</strong>
            <p>La connexion apparaîtra dès que les variables Supabase seront ajoutées dans Vercel.</p>
            <Link href="/">Voir la démonstration</Link>
          </div>
        ) : (
          <form action={signIn} className="auth-form">
            <label>
              Adresse e-mail
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Mot de passe
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit">Se connecter</button>
          </form>
        )}
      </section>
    </main>
  )
}
