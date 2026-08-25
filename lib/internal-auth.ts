import { timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

/**
 * Verifies the X-Internal-Key header against INTERNAL_API_KEY for
 * server-to-server endpoints the website calls cross-origin (CORS-open).
 *
 * Fails CLOSED: if INTERNAL_API_KEY isn't configured, every request is
 * rejected rather than the check being skipped — an unset secret must never
 * turn an authenticated endpoint into an open one.
 */
export function verifyInternalKey(req: Request): boolean {
  const expected = env.internalApiKey()
  if (!expected) return false

  const provided = req.headers.get('x-internal-key') ?? ''
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
