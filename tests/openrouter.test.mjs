import test from 'node:test'
import assert from 'node:assert/strict'
import { extractOpenRouterJson, validateOpenRouterEditorial } from '../src/openrouter.mjs'

test('accepts only editorial suggestions attached to real measured candidates', () => {
  const response = validateOpenRouterEditorial({ clips: [
    { candidate_id: 'video-1000', title: 'Le risque qui a tout changé', publication_hook: 'Cette décision pouvait faire tomber toute l’entreprise.', rationale: 'Le passage combine un enjeu concret et une expérience vécue.' },
    { candidate_id: 'invented-999', title: 'Faux extrait', publication_hook: 'Une accroche entièrement inventée.', rationale: 'Cet identifiant ne vient pas des passages transmis.' },
  ] }, ['video-1000'])

  assert.equal(response.length, 1)
  assert.equal(response[0].candidateId, 'video-1000')
})

test('extracts JSON even when a free model wraps it in a markdown fence', () => {
  assert.deepEqual(extractOpenRouterJson('```json\n{"clips":[]}\n```'), { clips: [] })
})
