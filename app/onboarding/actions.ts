'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { organizationSlug } from '@/src/organization.mjs'

const onboardingUrl = (message: string) => `/onboarding?error=${encodeURIComponent(message)}`

export async function createOrganization(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const slug = organizationSlug(formData.get('slug'))

  if (name.length < 2 || slug.length < 2) redirect(onboardingUrl('Indique un nom d’organisation valide.'))

  const supabase = await createSupabaseServerClient()
  if (!supabase) redirect('/login')

  const { error } = await supabase.rpc('create_organization_with_owner', {
    organization_name: name,
    organization_slug: slug,
  })
  if (error) redirect(onboardingUrl('Cet espace existe peut-être déjà. Choisis un autre identifiant.'))
  redirect('/')
}
