import crypto from 'crypto'

/**
 * API key handling.
 *
 * API keys are high-entropy random tokens, so a fast cryptographic hash
 * (SHA-256) is the correct choice — NOT bcrypt. bcrypt is deliberately slow
 * and meant for low-entropy human passwords; using it here would make every
 * authenticated API request needlessly expensive and is not indexable.
 *
 * Storage: we keep a SHA-256 hash of the full key plus a short prefix. At
 * verification time we look the row up by prefix (indexed) and constant-time
 * compare the hash — O(1) and safe against timing attacks.
 */

const PREFIX_LEN = 12

export interface GeneratedKey {
  rawKey: string    // shown to the user exactly once
  keyHash: string   // stored in DB
  keyPrefix: string // stored in DB, indexed for lookup
}

export function generateApiKey(): GeneratedKey {
  const rawKey = `pem_${crypto.randomBytes(24).toString('hex')}`
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    keyPrefix: rawKey.slice(0, PREFIX_LEN),
  }
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

export function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, PREFIX_LEN)
}

/** Constant-time comparison of a candidate key against a stored hash. */
export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(rawKey))
  const stored = Buffer.from(storedHash)
  if (candidate.length !== stored.length) return false
  return crypto.timingSafeEqual(candidate, stored)
}
