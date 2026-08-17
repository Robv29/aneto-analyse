import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDurationSeconds } from '@/src/analytics.mjs'
import { logInfo } from '@/lib/observability'

// Un short publié est un format court mis en ligne après le marquage.
const SHORT_MAX_DURATION_SECONDS = 180
// Au-delà, on considère que la publication n'a pas eu lieu.
const MATCH_WINDOW_DAYS = 21

type Admin = SupabaseClient

/**
 * Rattache les shorts marqués publiés aux contenus réellement mis en ligne,
 * puis rafraîchit leurs performances.
 *
 * Le rattachement est heuristique : Aneto ne connaît pas l'identifiant de la
 * publication (elle est faite à la main hors de l'app). On cherche donc, parmi
 * les formats courts synchronisés après le marquage, le plus proche dans le
 * temps. Un seul candidat dans la fenêtre = rattachement automatique ;
 * plusieurs = on prend le plus proche mais la liaison reste révisable.
 */
export async function reconcilePublishedShorts(admin: Admin, organizationId: string) {
  const { data: pending } = await admin
    .from('short_publications')
    .select('id, marked_at, published_content_item_id')
    .eq('organization_id', organizationId)
    .in('match_confidence', ['pending', 'automatic', 'confirmed'])
  if (!pending?.length) return { matched: 0, refreshed: 0 }

  const unmatched = pending.filter((row) => !row.published_content_item_id)
  const matched = pending.filter((row) => row.published_content_item_id)

  let newlyMatched = 0
  if (unmatched.length) {
    const oldestMark = unmatched.reduce((min, row) => row.marked_at < min ? row.marked_at : min, unmatched[0].marked_at)
    const { data: recentShorts } = await admin
      .from('content_items')
      .select('id, title, published_at, payload')
      .eq('organization_id', organizationId)
      .gte('published_at', oldestMark)
      .order('published_at', { ascending: true })

    // Seuls les formats courts sont éligibles, et un contenu déjà rattaché
    // ne peut pas l'être une seconde fois.
    const alreadyLinked = new Set(matched.map((row) => row.published_content_item_id))
    const candidates = (recentShorts ?? []).filter((item) => {
      if (alreadyLinked.has(item.id)) return false
      const duration = parseDurationSeconds({ payload: item.payload }) as number
      return duration > 0 && duration <= SHORT_MAX_DURATION_SECONDS
    })

    const now = Date.now()
    for (const publication of unmatched) {
      const markedAt = new Date(publication.marked_at).getTime()
      const windowEnd = markedAt + MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
      const inWindow = candidates.filter((item) => {
        if (!item.published_at || alreadyLinked.has(item.id)) return false
        const publishedAt = new Date(item.published_at).getTime()
        return publishedAt >= markedAt && publishedAt <= windowEnd
      })

      if (!inWindow.length) {
        // Passé la fenêtre sans rien trouver, on cesse de chercher.
        if (now > windowEnd) {
          await admin.from('short_publications')
            .update({ match_confidence: 'not_found' })
            .eq('id', publication.id)
        }
        continue
      }

      const best = inWindow[0]
      alreadyLinked.add(best.id)
      await admin.from('short_publications').update({
        published_content_item_id: best.id,
        match_confidence: 'automatic',
        matched_at: new Date().toISOString(),
        metrics: extractMetrics(best.payload),
        metrics_updated_at: new Date().toISOString(),
      }).eq('id', publication.id)
      newlyMatched += 1
      matched.push({ ...publication, published_content_item_id: best.id })
    }
  }

  // Rafraîchit les performances des publications déjà rattachées.
  let refreshed = 0
  const linkedIds = matched.map((row) => row.published_content_item_id).filter((id): id is string => Boolean(id))
  if (linkedIds.length) {
    const { data: items } = await admin
      .from('content_items')
      .select('id, payload')
      .in('id', linkedIds)
    const payloadById = new Map((items ?? []).map((item) => [item.id, item.payload]))
    const stamp = new Date().toISOString()
    for (const publication of matched) {
      const payload = payloadById.get(publication.published_content_item_id!)
      if (!payload) continue
      await admin.from('short_publications').update({
        metrics: extractMetrics(payload),
        metrics_updated_at: stamp,
      }).eq('id', publication.id)
      refreshed += 1
    }
  }

  if (newlyMatched || refreshed) {
    logInfo('publication_loop_reconciled', { organizationId, matched: newlyMatched, refreshed })
  }
  return { matched: newlyMatched, refreshed }
}

function extractMetrics(payload: unknown) {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    views: Number(data.viewCount) || 0,
    likes: Number(data.likeCount) || 0,
    comments: Number(data.commentCount) || 0,
    shares: Number(data.shareCount) || 0,
  }
}
