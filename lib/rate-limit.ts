// In-memory rate limiter — resets on server restart (sufficient for dev/small prod)
// For production at scale, replace the Map with Redis.

interface Entry {
  count: number
  firstAttempt: number
  lockedUntil?: number
}

const store = new Map<string, Entry>()

const MAX_ATTEMPTS  = 5          // lock after this many failures
const WINDOW_MS     = 15 * 60 * 1000  // 15-minute sliding window
const LOCKOUT_MS    = 15 * 60 * 1000  // locked for 15 minutes

export function checkRateLimit(key: string): {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
} {
  const now  = Date.now()
  const entry = store.get(key)

  if (!entry) return { allowed: true, remaining: MAX_ATTEMPTS }

  // If currently locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.lockedUntil - now }
  }

  // Window expired — reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.delete(key)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  const remaining = MAX_ATTEMPTS - entry.count
  if (remaining <= 0) {
    // Lock the account
    store.set(key, { ...entry, lockedUntil: now + LOCKOUT_MS })
    return { allowed: false, remaining: 0, retryAfterMs: LOCKOUT_MS }
  }

  return { allowed: true, remaining }
}

export function recordFailure(key: string): void {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry) {
    store.set(key, { count: 1, firstAttempt: now })
    return
  }

  // Window expired — fresh start
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttempt: now })
    return
  }

  const newCount = entry.count + 1
  store.set(key, {
    ...entry,
    count: newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : entry.lockedUntil,
  })
}

export function resetLimit(key: string): void {
  store.delete(key)
}
