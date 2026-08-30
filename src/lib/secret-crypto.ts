/**
 * At-rest encryption for secret setting values (API keys, tokens, PATs, passwords).
 *
 * Storage format: `enc:v1:<iv base64>:<tag base64>:<ciphertext base64>`
 * Algorithm: AES-256-GCM with a random 12-byte IV per encryption.
 *
 * Key source: process.env.APP_ENCRYPTION_KEY — accepts either a 64-char hex
 * string or a base64 string that decodes to exactly 32 bytes. If the key is
 * missing or invalid, encryption is skipped (values are stored as plaintext,
 * preserving pre-encryption behavior) and a single warning is logged.
 *
 * This module never throws: decryption failures of any kind (missing key,
 * malformed payload, wrong key, tampered tag) resolve to '' so callers can
 * treat that the same as "unset" and fall through to other sources.
 */
import crypto from 'crypto'

const ENC_PREFIX = 'enc:v1:'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

// `undefined` = not yet resolved this cache cycle; `null` = resolved to "no usable key".
let cachedKey: Buffer | null | undefined = undefined
let warned = false

function warnOnce(message: string): void {
  if (warned) return
  warned = true
  console.warn(message)
}

function parseKey(raw: string): Buffer | null {
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }
  const decoded = Buffer.from(trimmed, 'base64')
  if (decoded.length === KEY_LENGTH) return decoded
  return null
}

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey

  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    cachedKey = null
    warnOnce(
      'secret-crypto: APP_ENCRYPTION_KEY is not set — secret settings will be stored as plaintext.'
    )
    return null
  }

  const key = parseKey(raw)
  if (!key) {
    cachedKey = null
    warnOnce(
      'secret-crypto: APP_ENCRYPTION_KEY is not a valid 32-byte key (expected base64 or hex) — secret settings will be stored as plaintext.'
    )
    return null
  }

  cachedKey = key
  return key
}

/** Test-only: clears the memoized key and warn-once flag so env changes take effect. */
export function __resetKeyCache(): void {
  cachedKey = undefined
  warned = false
}

/** Returns true if the value is in the `enc:v1:...` storage format. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX)
}

/**
 * Encrypts a plaintext secret for storage. Returns the plaintext unchanged
 * (with a one-time warning) if no usable encryption key is configured.
 * Never encrypts an empty string — '' always means "unset".
 */
export function encryptSecret(plaintext: string): string {
  if (plaintext === '') return ''

  const key = getKey()
  if (!key) return plaintext

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

/**
 * Decrypts a stored value. Values without the `enc:v1:` prefix are assumed to
 * be legacy plaintext and are returned unchanged. Any decryption failure
 * (missing/invalid key, malformed payload, wrong key, tampered ciphertext)
 * returns '' rather than throwing.
 */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value

  const key = getKey()
  if (!key) return ''

  const parts = value.slice(ENC_PREFIX.length).split(':')
  if (parts.length !== 3) return ''
  const [ivB64, tagB64, ciphertextB64] = parts

  try {
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    return ''
  }
}
