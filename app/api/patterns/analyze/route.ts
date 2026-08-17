import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { analyzePerformancePatterns, isOpenRouterConfigured } from '@/lib/ai/openrouter'
import { getLibrary } from '@/lib/data/loaders'
import { computePerformancePatterns } from '@/lib/editorial/patterns'

export const maxDuration = 60

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  }

  const context = await getAuthenticatedOrganization()
  if (!context) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (context.role === 'viewer') return NextResponse.json({ error: 'Ton rôle ne permet pas de lancer cette analyse.' }, { status: 403 })
  if (!isOpenRouterConfigured()) return NextResponse.json({ error: 'La clé OpenRouter manque encore dans Vercel.' }, { status: 503 })

  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'Le service d’analyse n’est pas configuré.' }, { status: 503 })

  const library = await getLibrary({
    supabase: context.supabase,
    viewer: { id: context.userId, email: null, displayName: null },
    organization: { id: context.organizationId, name: '', slug: '', role: context.role },
  })
  const patterns = computePerformancePatterns(library)
  if (patterns.sampleSize < 3) {
    return NextResponse.json({ error: 'Il faut au moins 3 contenus avec des statistiques pour analyser ce qui marche.' }, { status: 400 })
  }

  try {
    const { result, model } = await analyzePerformancePatterns(patterns)
    const { error: insertError } = await admin.from('ai_analyses').insert({
      organization_id: context.organizationId,
      content_item_id: null,
      kind: 'performance_insights',
      version: 1,
      model,
      payload: { ...result, patterns_sample: patterns.sampleSize },
    })
    if (insertError) throw insertError
    revalidatePath('/patterns')
    return NextResponse.json({ ok: true, message: `Lecture mise à jour sur ${patterns.sampleSize} contenus.` })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : 'openrouter_error'
    return NextResponse.json({ error: `L’analyse n’a pas abouti : ${message}` }, { status: 502 })
  }
}
