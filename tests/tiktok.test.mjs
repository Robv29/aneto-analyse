import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTikTokVideo } from '../src/connectors/tiktok.mjs'

test('normalizeTikTokVideo preserves performance data and public URL', () => {
  const result = normalizeTikTokVideo({
    id: '7345',
    title: '',
    video_description: 'Le vrai coût d’une mauvaise décision',
    create_time: 1_700_000_000,
    duration: 42,
    share_url: 'https://www.tiktok.com/@aneto.media/video/7345',
    view_count: 1200,
    like_count: 86,
    comment_count: 9,
    share_count: 13,
  }, '2026-08-11T12:00:00.000Z')

  assert.equal(result.externalId, '7345')
  assert.equal(result.title, 'Le vrai coût d’une mauvaise décision')
  assert.equal(result.payload.viewCount, 1200)
  assert.equal(result.payload.durationSeconds, 42)
  assert.equal(result.payload.shareUrl, 'https://www.tiktok.com/@aneto.media/video/7345')
})

test('normalizeTikTokVideo rejects an item without id', () => {
  assert.throws(() => normalizeTikTokVideo({ title: 'Sans identifiant' }), /id is required/)
})
