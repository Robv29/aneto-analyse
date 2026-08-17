const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

const firstLine = (caption) => {
  const clean = String(caption ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const sentence = clean.match(/^.{10,90}?[.!?](?=\s|$)/)?.[0] ?? clean.slice(0, 90)
  return sentence.trim()
}

export function normalizeInstagramMedia(media, observedAt = new Date().toISOString()) {
  if (!media || !media.id) throw new TypeError('Instagram media id is required')

  const caption = String(media.caption ?? '').trim()
  const title = firstLine(caption) || `Publication Instagram ${media.media_type ?? ''}`.trim()
  // Les métriques de lecture ne sont fournies que pour les Reels ; on retient
  // la meilleure disponible pour que le contenu soit comparable aux vidéos.
  const insights = media.insights ?? {}
  const views = finiteNumber(insights.views ?? insights.plays ?? insights.reach ?? media.video_view_count)

  return {
    externalId: String(media.id),
    title,
    publishedAt: media.timestamp ? new Date(media.timestamp).toISOString() : null,
    observedAt,
    payload: {
      description: caption,
      mediaType: media.media_type ? String(media.media_type) : null,
      productType: media.media_product_type ? String(media.media_product_type) : null,
      shareUrl: media.permalink ? String(media.permalink) : null,
      coverImageUrl: media.thumbnail_url ? String(media.thumbnail_url) : media.media_url ? String(media.media_url) : null,
      viewCount: views,
      likeCount: finiteNumber(media.like_count),
      commentCount: finiteNumber(media.comments_count),
      reach: finiteNumber(insights.reach),
      saved: finiteNumber(insights.saved),
      shareCount: finiteNumber(insights.shares),
      // Les Reels sont des formats courts : la durée permet à la boucle de
      // mesure de les reconnaître comme des shorts publiés.
      durationSeconds: finiteNumber(media.duration ?? insights.duration),
    },
  }
}

export function isInstagramShortFormat(media) {
  const productType = String(media?.media_product_type ?? '').toUpperCase()
  return productType === 'REELS' || String(media?.media_type ?? '').toUpperCase() === 'VIDEO'
}
