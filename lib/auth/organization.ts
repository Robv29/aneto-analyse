import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getAuthenticatedOrganization() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', authData.user.id)
    .limit(1)
    .maybeSingle()

  if (error || !membership) return null
  return {
    supabase,
    userId: authData.user.id,
    organizationId: membership.organization_id,
    role: membership.role as 'owner' | 'admin' | 'editor' | 'viewer',
  }
}
