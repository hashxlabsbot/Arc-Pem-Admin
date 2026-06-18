/**
 * Rate limiter for auth/registration endpoints.
 *
 * Backend is pluggable:
 *  - If UPSTASH_REDIS_REST_URL + TOKEN are set, uses Upstash Redis over its
 *    REST API (no extra npm dependency, works across every serverless instance).
 *  - Otherwise falls back to an in-memory Map (fine for a single dev/box, but
 *    NOT shared across instances — set up Upstash for multi-instance production).
 *
 * Semantics: a sliding fixed window. After MAX_ATTEMPTS failures within the
 * window the key is locked until the window TTL expires.
 */
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15-minute window == lockout duration

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
}

// ---------------------------------------------------------------------------
// Upstash Redis (REST) backend
// ---------------------------------------------------------------------------

const REDIS_URL = env.upstashUrl()
const REDIS_TOKEN = env.upstashToken()
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN)

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    // Never cache rate-limit lookups.
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { result: unknown }
  return data.result
}

const rk = (key: string) => `rl:${key}`

async function redisCheck(key: string): Promise<RateLimitResult> {
  const k = rk(key)
  const [countRaw, pttlRaw] = (await Promise.all([
    redis(['GET', k]),
    redis(['PTTL', k]),
  ])) as [string | null, number]
  const count = countRaw ? parseInt(countRaw, 10) : 0
  if (count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: pttlRaw > 0 ? pttlRaw : WINDOW_MS }
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - count }
}

async function redisRecordFailure(key: string): Promise<void> {
  const k = rk(key)
  const count = (await redis(['INCR', k])) as number
  if (count === 1) {
    // First failure in this window — start the TTL.
    await redis(['PEXPIRE', k, WINDOW_MS])
  }
}

async function redisReset(key: string): Promise<void> {
  await redis(['DEL', rk(key)])
}

// ---------------------------------------------------------------------------
// In-memory fallback backend
// ---------------------------------------------------------------------------

interface Entry {
  count: number
  firstAttempt: number
}
const store = new Map<string, Entry>()

function memCheck(key: string): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry) return { allowed: true, remaining: MAX_ATTEMPTS }
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.delete(key)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: WINDOW_MS - (now - entry.firstAttempt) }
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count }
}

function memRecordFailure(key: string): void {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttempt: now })
    return
  }
  store.set(key, { ...entry, count: entry.count + 1 })
}

function memReset(key: string): void {
  store.delete(key)
}

// ---------------------------------------------------------------------------
// Public API (always async). Redis failures degrade open but are logged.
// ---------------------------------------------------------------------------

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  if (useRedis) {
    try {
      return await redisCheck(key)
    } catch (err) {
      logger.error('rate-limit redis check failed; allowing request', err, { key })
      return { allowed: true, remaining: MAX_ATTEMPTS }
    }
  }
  return memCheck(key)
}

export async function recordFailure(key: string): Promise<void> {
  if (useRedis) {
    try {
      await redisRecordFailure(key)
      return
    } catch (err) {
      logger.error('rate-limit redis record failed', err, { key })
      return
    }
  }
  memRecordFailure(key)
}

export async function resetLimit(key: string): Promise<void> {
  if (useRedis) {
    try {
      await redisReset(key)
      return
    } catch (err) {
      logger.error('rate-limit redis reset failed', err, { key })
      return
    }
  }
  memReset(key)
}
