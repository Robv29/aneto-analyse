import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClipCopyText, extractOpenRouterJson, validateOpenRouterEditorial, validateOpenRouterMarketStudy } from '../src/openrouter.mjs'

test('accepts only editorial suggestions attached to real measured candidates', () => {
  const response = validateOpenRouterEditorial({ clips: [
    { candidate_id: 'video-1000', title: 'Le risque qui a tout changé', publication_hook: 'Cette décision pouvait faire tomber toute l’entreprise.', rationale: 'Le passage combine un enjeu concret et une expérience vécue.', market_angle: 'Une décision de dirigeant prise sous une forte contrainte.', target_audience: 'Dirigeants de PME', caption: 'Une décision coûteuse peut parfois être la seule façon de protéger son équipe. Et vous, comment auriez-vous tranché ?', hashtags: ['dirigeant', '#PME', '#management'], platform_fit: ['LinkedIn', 'YouTube Shorts'] },
    { candidate_id: 'invented-999', title: 'Faux extrait', publication_hook: 'Une accroche entièrement inventée.', rationale: 'Cet identifiant ne vient pas des passages transmis.', market_angle: 'Un faux angle suffisamment long.', target_audience: 'Audience fictive', caption: 'Une fausse publication qui ne doit jamais parvenir dans le produit.', hashtags: ['#faux', '#test', '#fiction'] },
  ] }, ['video-1000'])

  assert.equal(response.length, 1)
  assert.equal(response[0].candidateId, 'video-1000')
  assert.deepEqual(response[0].hashtags, ['#dirigeant', '#PME', '#management'])
})

test('extracts JSON even when a free model wraps it in a markdown fence', () => {
  assert.deepEqual(extractOpenRouterJson('```json\n{"clips":[]}\n```'), { clips: [] })
})

test('validates a market study only when evidence fields are complete', () => {
  assert.deepEqual(validateOpenRouterMarketStudy({ market_study: {
    opportunity: 'Les décisions vécues concentrent les meilleurs signaux de conversation.',
    audience: 'Dirigeants et responsables d’équipe en transformation.',
    differentiation: 'Faire parler les opérateurs sur des décisions réelles plutôt que donner des conseils génériques.',
    market_signal: 'Tester les angles de décision difficile sur les prochains extraits.',
  } }), {
    opportunity: 'Les décisions vécues concentrent les meilleurs signaux de conversation.',
    audience: 'Dirigeants et responsables d’équipe en transformation.',
    differentiation: 'Faire parler les opérateurs sur des décisions réelles plutôt que donner des conseils génériques.',
    marketSignal: 'Tester les angles de décision difficile sur les prochains extraits.',
  })
  assert.equal(validateOpenRouterMarketStudy({ market_study: { opportunity: 'seul' } }), null)
})

test('builds a ready-to-copy package with caption and normalized hashtags', () => {
  assert.equal(buildClipCopyText({
    title: 'La décision qui change tout',
    caption: 'Le coût du statu quo était devenu plus lourd que le changement.',
    hashtags: ['#Management', 'PME', '#Décision'],
  }), 'La décision qui change tout\n\nLe coût du statu quo était devenu plus lourd que le changement.\n\n#Management #PME #Décision')
})
