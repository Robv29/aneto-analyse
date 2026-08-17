import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type WorkspaceSession = {
  mode: 'demo' | 'live'
  supabase: SupabaseClient | null
  viewer: null | { id: string; email: string | null; displayName: string | null }
  organization: null | { id: string; name: string; slug: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }
}

// Une seule résolution de session par requête : chaque page et le layout
// partagent le même résultat grâce à React cache().
export const getSessionContext = cache(async (): Promise<WorkspaceSession> => {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { mode: 'demo', supabase: null, viewer: null, organization: null }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  // Des cookies expirés sont un état non authentifié, pas un incident.
  if (authError || !authData.user) return { mode: 'live', supabase, viewer: null, organization: null }

  const user = authData.user
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase.from('memberships')
      .select('organization_id, role, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const viewer = { id: user.id, email: user.email ?? null, displayName: profile?.display_name ?? null }
  if (!membership) return { mode: 'live', supabase, viewer, organization: null }

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', membership.organization_id)
    .single()
  if (organizationError || !organization) throw new Error('Organisation introuvable malgré une adhésion active.')

  return {
    mode: 'live',
    supabase,
    viewer,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: membership.role as 'owner' | 'admin' | 'editor' | 'viewer',
    },
  }
})

export type ActiveWorkspace = {
  supabase: SupabaseClient
  viewer: NonNullable<WorkspaceSession['viewer']>
  organization: NonNullable<WorkspaceSession['organization']>
}

export function asActiveWorkspace(session: WorkspaceSession): ActiveWorkspace | null {
  if (session.mode !== 'live' || !session.supabase || !session.viewer || !session.organization) return null
  return { supabase: session.supabase, viewer: session.viewer, organization: session.organization }
}
