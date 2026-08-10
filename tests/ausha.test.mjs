import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAushaPodcast } from '../src/connectors/ausha.mjs'

test('normalizes an Ausha podcast without leaking undocumented shape', () => {
  const item = normalizeAushaPodcast({
    id: 654,
    name: 'Une décision à 160 000 €',
    published_at: '2026-08-01T08:00:00+00:00',
    updated_at: '2026-08-03T09:30:00+00:00',
    duration: 845.77,
    downloads_count: 2297,
    guid: 'episode-guid',
    audio_url: 'https://audio.ausha.co/example.mp3',
    state: 'active',
    ignored_private_field: 'never copied',
  })

  assert.equal(item.externalId, '654')
  assert.equal(item.title, 'Une décision à 160 000 €')
  assert.equal(item.payload.downloadsCount, 2297)
  assert.equal('ignored_private_field' in item.payload, false)
})

test('rejects malformed Ausha podcasts', () => {
  assert.throws(() => normalizeAushaPodcast({ id: 1 }), /name is required/)
  assert.throws(() => normalizeAushaPodcast({ name: 'Missing id' }), /id is required/)
})
