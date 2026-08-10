'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const loginUrl = (message: string) => `/login?error=${encodeURIComponent(message)}`

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) redirect(loginUrl('Renseigne ton adresse e-mail et ton mot de passe.'))

  const supabase = await createSupabaseServerClient()
  if (!supabase) redirect(loginUrl('Supabase n’est pas encore configuré.'))

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(loginUrl('Connexion impossible. Vérifie tes identifiants.'))
  redirect('/')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  if (supabase) await supabase.auth.signOut()
  redirect('/login')
}
