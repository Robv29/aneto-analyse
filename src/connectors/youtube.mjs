const stringOrNull = (value) => typeof value === 'string' && value.length ? value : null
const countOrNull = (value) => /^\d+$/.test(String(value ?? '')) ? Number(value) : null

export function normalizeYouTubeVideo(input, observedAt = new Date().toISOString()) {
  if (!input || typeof input.id !== 'string' || !input.id) throw new TypeError('YouTube video id is required')
  if (typeof input.snippet?.title !== 'string' || !input.snippet.title.trim()) {
    throw new TypeError('YouTube video title is required')
  }

  const thumbnails = input.snippet.thumbnails ?? {}
  const thumbnail = thumbnails.maxres ?? thumbnails.standard ?? thumbnails.high ?? thumbnails.medium ?? thumbnails.default
  return {
    externalId: input.id,
    title: input.snippet.title.trim(),
    publishedAt: stringOrNull(input.snippet.publishedAt),
    observedAt,
    payload: {
      description: stringOrNull(input.snippet.description),
      channelId: stringOrNull(input.snippet.channelId),
      channelTitle: stringOrNull(input.snippet.channelTitle),
      categoryId: stringOrNull(input.snippet.categoryId),
      tags: Array.isArray(input.snippet.tags) ? input.snippet.tags.filter((tag) => typeof tag === 'string') : [],
      thumbnailUrl: stringOrNull(thumbnail?.url),
      duration: stringOrNull(input.contentDetails?.duration),
      definition: stringOrNull(input.contentDetails?.definition),
      captioned: input.contentDetails?.caption === 'true',
      viewCount: countOrNull(input.statistics?.viewCount),
      likeCount: countOrNull(input.statistics?.likeCount),
      commentCount: countOrNull(input.statistics?.commentCount),
      favoriteCount: countOrNull(input.statistics?.favoriteCount),
    },
  }
}
