import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClipCandidates } from '../src/clips.mjs'

const makeSegments = () => {
  const segments = []
  for (let index = 0; index < 40; index += 1) {
    const start = index * 30
    segments.push({
      start,
      end: start + 28,
      text: `J'ai compris que continuer comme ça allait nous coûter beaucoup plus cher que de tout changer, mais la vraie décision concernait toute l'équipe et son avenir. Pourquoi avoir attendu si longtemps avant de trancher cette question ?`,
    })
  }
  return segments
}

test('generates candidates from timed segments', () => {
  const candidates = buildClipCandidates(makeSegments(), { videoId: 'abc', limit: 5 })
  assert.ok(candidates.length >= 3)
  for (const candidate of candidates) {
    assert.match(candidate.id, /^abc-\d+$/)
    assert.ok(candidate.duration >= 18)
  }
})

test('never re-proposes an excluded range (marge de 15 s incluse)', () => {
  const segments = makeSegments()
  const first = buildClipCandidates(segments, { videoId: 'abc', limit: 4 })
  assert.ok(first.length >= 2)

  const excludeRanges = first.map((candidate) => ({ start: candidate.start, end: candidate.end }))
  const next = buildClipCandidates(segments, { videoId: 'abc', limit: 4, excludeRanges })

  const firstKeys = new Set(first.map((candidate) => candidate.id))
  for (const candidate of next) {
    assert.ok(!firstKeys.has(candidate.id), `candidat ${candidate.id} reproposé`)
    for (const range of excludeRanges) {
      const overlaps = candidate.start < range.end + 15 && candidate.end > range.start - 15
      assert.ok(!overlaps, `candidat ${candidate.id} chevauche la plage exclue ${range.start}-${range.end}`)
    }
  }
})

test('returns nothing when the whole transcript is excluded', () => {
  const segments = makeSegments()
  const totalDuration = segments.at(-1).end
  const candidates = buildClipCandidates(segments, {
    videoId: 'abc',
    limit: 4,
    excludeRanges: [{ start: 0, end: totalDuration }],
  })
  assert.equal(candidates.length, 0)
})
