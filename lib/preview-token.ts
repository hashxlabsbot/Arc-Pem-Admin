import { createHmac } from 'crypto'

/**
 * Signs a short-lived, per-post preview token the marketing site verifies
 * (see Arch-Pem-Website-User/lib/preview-token.ts — HMAC must match exactly).
 * Token = `${expiryMs}.${hmac}`, hmac = HMAC-SHA256(`${id}.${expiryMs}`, PREVIEW_SECRET).
 */
export function signPreviewToken(id: string, ttlMs = 30 * 60 * 1000): string {
  const secret = process.env.PREVIEW_SECRET
  if (!secret) throw new Error('PREVIEW_SECRET not configured')
  const exp = String(Date.now() + ttlMs)
  const sig = createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex')
  return `${exp}.${sig}`
}
