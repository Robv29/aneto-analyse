import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { decryptCredential, encryptCredential } from '../src/security/credentials.mjs'

test('connector credentials round-trip through authenticated encryption', () => {
  const key = randomBytes(32).toString('base64')
  const encrypted = encryptCredential('ausha-secret-token', key)
  assert.notEqual(encrypted.ciphertext, 'ausha-secret-token')
  assert.equal(decryptCredential(encrypted, key), 'ausha-secret-token')
})

test('credential decryption rejects tampering', () => {
  const key = randomBytes(32).toString('base64')
  const encrypted = encryptCredential('ausha-secret-token', key)
  assert.throws(() => decryptCredential({ ...encrypted, authTag: randomBytes(16).toString('base64') }, key))
})
