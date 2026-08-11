const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export function normalizeTikTokVideo(video, observedAt = new Date().toISOString()) {
  if (!video || !video.id) throw new TypeError('TikTok video id is required')

  const description = String(video.video_description ?? '').trim()
  const title = String(video.title ?? '').trim() || description || 'Vidéo TikTok sans titre'
  const publishedAt = finiteNumber(video.create_time)
    ? new Date(finiteNumber(video.create_time) * 1000).toISOString()
    : null

  return {
    externalId: String(video.id),
    title,
    publishedAt,
    observedAt,
    payload: {
      description,
      durationSeconds: finiteNumber(video.duration),
      coverImageUrl: video.cover_image_url ? String(video.cover_image_url) : null,
      shareUrl: video.share_url ? String(video.share_url) : null,
      viewCount: finiteNumber(video.view_count),
      likeCount: finiteNumber(video.like_count),
      commentCount: finiteNumber(video.comment_count),
      shareCount: finiteNumber(video.share_count),
    },
  }
}
