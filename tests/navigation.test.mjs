import test from 'node:test'
import assert from 'node:assert/strict'
import { pathForView, viewForPath } from '../src/navigation.mjs'

test('every product view has a stable route', () => {
  const routes = {
    today: '/',
    intelligence: '/intelligence',
    graph: '/graph',
    memory: '/memory',
    research: '/research',
  }
  for (const [view, path] of Object.entries(routes)) {
    assert.equal(pathForView(view), path)
    assert.equal(viewForPath(path), view)
  }
})

test('unknown routes never select a dead module', () => {
  assert.equal(viewForPath('/inconnu'), 'today')
})
