import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeYouTubeVideo, plainTextFromVtt } from '../src/connectors/youtube.mjs'
import { buildClipCandidates, formatClipTime, timedSegmentsFromVtt } from '../src/clips.mjs'

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

test('converts YouTube VTT captions into readable transcript text', () => {
  const transcript = plainTextFromVtt(`WEBVTT

00:00:00.000 --> 00:00:02.000
<c>Bonjour &amp; bienvenue.</c>

00:00:02.000 --> 00:00:04.000
Bonjour &amp; bienvenue.

00:00:04.000 --> 00:00:06.000
Voici la suite.`)

  assert.equal(transcript, 'Bonjour & bienvenue.\nVoici la suite.')
})

test('preserves exact caption timecodes for video cuts', () => {
  const segments = timedSegmentsFromVtt(`WEBVTT

00:02:31.500 --> 00:02:34.000
<c>J'ai failli tout perdre.</c>

00:02:34.000 --> 00:02:38.250
Mais cette erreur a changé mon entreprise.`)

  assert.deepEqual(segments, [
    { start: 151.5, end: 154, text: "J'ai failli tout perdre." },
    { start: 154, end: 158.25, text: 'Mais cette erreur a changé mon entreprise.' },
  ])
  assert.equal(formatClipTime(151), '2:31')
})

test('ranks self-contained short candidates without inventing transcript text', () => {
  const segments = Array.from({ length: 18 }, (_, index) => ({
    start: index * 3,
    end: index * 3 + 3,
    text: index === 0
      ? "J'ai failli perdre un million d'euros, mais cette erreur a changé toute ma manière de décider."
      : `Voici la partie ${index} de cette histoire et ce que nous avons appris ensuite${index === 12 ? '.' : ''}`,
  }))
  const [candidate] = buildClipCandidates(segments, { videoId: 'video-1' })

  assert.equal(candidate.start, 0)
  assert.ok(candidate.duration >= 34 && candidate.duration <= 58)
  assert.match(candidate.hook, /failli perdre un million/)
  assert.ok(candidate.reasons.includes('tension narrative'))
  assert.ok(candidate.excerpt.includes(segments[0].text))
})

test('combines semantic strength with measured retention when available', () => {
  const segments = Array.from({ length: 14 }, (_, index) => ({
    start: index * 3,
    end: index * 3 + 3,
    text: index === 0 ? "J'ai pris la décision la plus risquée de ma vie." : `La suite de cette décision numéro ${index}.`,
  }))
  const retentionPoints = Array.from({ length: 100 }, (_, index) => ({
    elapsedRatio: (index + 1) / 100,
    audienceWatchRatio: .82,
    relativeRetentionPerformance: .91,
  }))
  const [candidate] = buildClipCandidates(segments, { videoId: 'video-2', durationSeconds: 42, retentionPoints })

  assert.ok(candidate.retention)
  assert.ok(Math.abs(candidate.retention.relativeRetentionPerformance - .91) < .0001)
  assert.ok(candidate.reasons.includes('pic de rétention mesuré'))
})
