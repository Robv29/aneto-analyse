import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeYouTubeVideo } from '../src/connectors/youtube.mjs'

test('normalizes a YouTube video and its public statistics', () => {
  const item = normalizeYouTubeVideo({
    id: 'video-123',
    snippet: {
      title: 'Une idée forte',
      description: 'Description',
      publishedAt: '2026-08-01T08:00:00Z',
      channelId: 'channel-1',
      channelTitle: 'aneto.',
      thumbnails: { high: { url: 'https://img.youtube.com/example.jpg' } },
      tags: ['média', 'stratégie'],
    },
    contentDetails: { duration: 'PT4M12S', definition: 'hd', caption: 'true' },
    statistics: { viewCount: '2048', likeCount: '125', commentCount: '9' },
    privateData: 'never copied',
  }, '2026-08-11T09:00:00Z')

  assert.equal(item.externalId, 'video-123')
  assert.equal(item.payload.viewCount, 2048)
  assert.equal(item.payload.captioned, true)
  assert.equal('privateData' in item.payload, false)
})

test('rejects malformed YouTube videos', () => {
  assert.throws(() => normalizeYouTubeVideo({ snippet: { title: 'Missing id' } }), /id is required/)
  assert.throws(() => normalizeYouTubeVideo({ id: 'video-1', snippet: {} }), /title is required/)
})
