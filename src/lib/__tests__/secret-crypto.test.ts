import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  isEncrypted,
  encryptSecret,
  decryptSecret,
  __resetKeyCache,
} from '@/lib/secret-crypto'

// A stable 32-byte key, expressed both ways, for tests that need a working key.
const KEY_HEX = 'a'.repeat(64) // 32 bytes of 0xaa
const KEY_BASE64 = Buffer.from(KEY_HEX, 'hex').toString('base64')

beforeEach(() => {
  __resetKeyCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  __resetKeyCache()
  vi.restoreAllMocks()
})

describe('isEncrypted', () => {
  it('is true for values with the enc:v1: prefix', () => {
    expect(isEncrypted('enc:v1:aaa:bbb:ccc')).toBe(true)
  })

  it('is false for plaintext values', () => {
    expect(isEncrypted('plain-value')).toBe(false)
    expect(isEncrypted('')).toBe(false)
  })
})

describe('encryptSecret / decryptSecret round trip (key present)', () => {
  it('round-trips a value: decrypt(encrypt(x)) === x', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('my-secret-value')
    expect(decryptSecret(encrypted)).toBe('my-secret-value')
  })

  it('produces output prefixed with enc:v1:', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('another-secret')
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
  })

  it('produces different ciphertext for two encryptions of the same input (random IV)', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const a = encryptSecret('same-input')
    const b = encryptSecret('same-input')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-input')
    expect(decryptSecret(b)).toBe('same-input')
  })
})

describe('decryptSecret passthrough', () => {
  it('returns non-prefixed (plaintext) values unchanged', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    expect(decryptSecret('just-a-plain-string')).toBe('just-a-plain-string')
  })
})

describe('empty string handling', () => {
  it('never encrypts an empty string, key present', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    expect(encryptSecret('')).toBe('')
  })

  it('never encrypts an empty string, key missing', () => {
    expect(encryptSecret('')).toBe('')
  })
})

describe('missing key', () => {
  it('encryptSecret returns the plaintext unchanged when no key is configured', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = encryptSecret('unencrypted-because-no-key')
    expect(result).toBe('unencrypted-because-no-key')
    warnSpy.mockRestore()
  })

  it('decryptSecret of a prefixed value returns "" when no key is configured', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Build a syntactically valid enc:v1: payload (contents don't matter — no key means immediate '').
    const fakeEncrypted = 'enc:v1:aaaaaaaaaaaa:bbbbbbbbbbbbbbbb:cccccccc'
    expect(decryptSecret(fakeEncrypted)).toBe('')
    warnSpy.mockRestore()
  })

  it('warns only once across repeated calls', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    encryptSecret('a')
    encryptSecret('b')
    decryptSecret('enc:v1:x:y:z')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})

describe('corrupt/wrong-key decryption failures', () => {
  it('returns "" for corrupt ciphertext without throwing', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('sensitive-data')
    const parts = encrypted.split(':')
    // Corrupt the ciphertext segment (last part).
    parts[4] = Buffer.from('not-the-real-ciphertext').toString('base64')
    const corrupted = parts.join(':')
    expect(() => decryptSecret(corrupted)).not.toThrow()
    expect(decryptSecret(corrupted)).toBe('')
  })

  it('returns "" when decrypting with the wrong key', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('sensitive-data')

    __resetKeyCache()
    const otherKeyHex = 'b'.repeat(64)
    vi.stubEnv('APP_ENCRYPTION_KEY', otherKeyHex)
    expect(() => decryptSecret(encrypted)).not.toThrow()
    expect(decryptSecret(encrypted)).toBe('')
  })

  it('returns "" for a malformed payload (wrong number of segments)', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    expect(decryptSecret('enc:v1:onlyonepart')).toBe('')
  })
})

describe('key encoding acceptance', () => {
  it('accepts a 32-byte base64-encoded key', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_BASE64)
    const encrypted = encryptSecret('base64-key-test')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(decryptSecret(encrypted)).toBe('base64-key-test')
  })

  it('accepts a 64-char hex-encoded key', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('hex-key-test')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(decryptSecret(encrypted)).toBe('hex-key-test')
  })

  it('treats a wrong-length key as missing (falls back to plaintext)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('APP_ENCRYPTION_KEY', 'too-short-key')
    const result = encryptSecret('should-stay-plaintext')
    expect(result).toBe('should-stay-plaintext')
    warnSpy.mockRestore()
  })
})
