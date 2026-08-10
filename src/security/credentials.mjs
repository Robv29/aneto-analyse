import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function decodeKey(keyBase64) {
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) throw new Error('Credential encryption key must contain exactly 32 bytes.')
  return key
}

export function encryptCredential(value, keyBase64) {
  if (!value) throw new Error('Credential cannot be empty.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', decodeKey(keyBase64), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptCredential(secret, keyBase64) {
  const decipher = createDecipheriv('aes-256-gcm', decodeKey(keyBase64), Buffer.from(secret.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
