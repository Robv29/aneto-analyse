const stringOrNull = (value) => typeof value === 'string' && value.length ? value : null
const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null

export function normalizeAushaPodcast(input) {
  if (!input || (typeof input.id !== 'number' && typeof input.id !== 'string')) {
    throw new TypeError('Ausha podcast id is required')
  }
  if (typeof input.name !== 'string' || !input.name.trim()) {
    throw new TypeError('Ausha podcast name is required')
  }

  return {
    externalId: String(input.id),
    title: input.name.trim(),
    publishedAt: stringOrNull(input.published_at),
    observedAt: stringOrNull(input.updated_at) || stringOrNull(input.created_at),
    payload: {
      publicId: stringOrNull(input.public_id),
      guid: stringOrNull(input.guid),
      description: stringOrNull(input.description),
      state: stringOrNull(input.state),
      durationSeconds: numberOrNull(input.duration),
      downloadsCount: numberOrNull(input.downloads_count),
      audioUrl: stringOrNull(input.audio_url),
      imageUrl: stringOrNull(input.image_url),
      url: stringOrNull(input.url),
      type: stringOrNull(input.type),
    },
  }
}
