import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeContent, editorialSignal, extractTopics, extractTranscriptKeywords, parseDurationSeconds, primaryMetric } from '../src/analytics.mjs'

const videos = [
  { kind: 'video', provider: 'youtube', title: 'Créer une marque forte', payload: { viewCount: 1200, likeCount: 90, commentCount: 15, duration: 'PT12M30S', tags: ['Marque', 'Entrepreneuriat'] } },
  { kind: 'video', provider: 'youtube', title: 'Diriger une marque', payload: { viewCount: 800, likeCount: 45, commentCount: 10, duration: 'PT7M30S', tags: ['Marque', 'Leadership'] } },
]

test('uses the provider metric without inventing values', () => {
  assert.equal(primaryMetric(videos[0]), 1200)
  assert.equal(primaryMetric({ kind: 'episode', provider: 'ausha', payload: { downloadsCount: 42 } }), 42)
})

test('parses synchronized media durations', () => {
  assert.equal(parseDurationSeconds(videos[0]), 750)
  assert.equal(parseDurationSeconds({ payload: { durationSeconds: 90 } }), 90)
})

test('extracts recurring topics from real tags', () => {
  assert.deepEqual(extractTopics(videos, 2), [{ label: 'Marque', count: 2 }, { label: 'Entrepreneuriat', count: 1 }])
})

test('aggregates real performance statistics', () => {
  const analysis = analyzeContent(videos)
  assert.equal(analysis.count, 2)
  assert.equal(analysis.totalViews, 2000)
  assert.equal(analysis.averagePrimary, 1000)
  assert.equal(analysis.averageDurationSeconds, 600)
  assert.equal(analysis.engagementRate, 8)
  assert.equal(analysis.top.title, 'Créer une marque forte')
})

test('extracts semantic keywords from a stored transcript', () => {
  assert.deepEqual(extractTranscriptKeywords('Média média stratégie. Une stratégie éditoriale pour le média.', 3), ['média', 'stratégie', 'éditoriale'])
})

test('rejects conversational filler before claiming an editorial topic', () => {
  assert.deepEqual(extractTranscriptKeywords('Donc voilà, alors en fait, je pense vraiment qu’il faut, faudrait, parler et regarder.', 8), [])
  const topics = extractTopics([{ transcript: { keywords: ['donc', 'voilà', 'entrepreneuriat'] }, payload: { tags: ['Dirigeant'] } }])
  assert.deepEqual(topics, [{ label: 'entrepreneuriat', count: 1 }])
  assert.equal(editorialSignal(topics), null)
  assert.equal(editorialSignal([{ label: 'entrepreneuriat', count: 2 }]), null)
  assert.deepEqual(editorialSignal([{ label: 'entrepreneuriat', count: 3 }]), { label: 'entrepreneuriat', count: 3 })
  assert.equal(editorialSignal([{ label: 'faut', count: 12 }]), null)
  assert.equal(editorialSignal([{ label: 'faudrait', count: 8 }]), null)
})

test('does not reject meaningful nouns that resemble verb endings', () => {
  assert.deepEqual(extractTranscriptKeywords('Portrait portrait stratégie', 2), ['portrait', 'stratégie'])
})
