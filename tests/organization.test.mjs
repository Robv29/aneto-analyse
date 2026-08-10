import test from 'node:test'
import assert from 'node:assert/strict'
import { organizationSlug } from '../src/organization.mjs'

test('organization slugs are stable and URL safe', () => {
  assert.equal(organizationSlug('  Anéto Média  '), 'aneto-media')
  assert.equal(organizationSlug('Le Podcast — B2B'), 'le-podcast-b2b')
})

test('organization slugs remove unsafe edge characters', () => {
  assert.equal(organizationSlug('---Démo---'), 'demo')
  assert.equal(organizationSlug(null), '')
})
