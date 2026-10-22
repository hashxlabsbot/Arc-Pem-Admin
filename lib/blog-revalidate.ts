import { logger } from '@/lib/logger'

/**
 * Tell the marketing site (Arch-Pem-Website-User) to rebuild the affected blog
 * pages immediately, so a published/edited post appears within seconds with no
 * redeploy. Machine-to-machine: authenticated by a shared secret, not a user
 * session. Fire-and-forget — a revalidation failure must never fail the save.
 */
export async function revalidateMarketingBlog(slug?: string): Promise<void> {
  const base = process.env.MARKETING_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!base || !secret) {
    logger.error('revalidateMarketingBlog: MARKETING_URL or REVALIDATE_SECRET not set — skipping revalidation')
    return
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ slug }),
      cache: 'no-store',
    })
    if (!res.ok) {
      logger.error(`revalidateMarketingBlog: ${res.status} ${await res.text().catch(() => '')}`)
    }
  } catch (err) {
    logger.error('revalidateMarketingBlog request failed', err)
  }
}

/**
 * Prices changed (a plan, or the billing settings): rebuild the marketing pages that show them — home, pricing and
 * the AI briefings. Fire-and-forget like the blog hook.
 */
export async function revalidateMarketingPricing(): Promise<void> {
  const base = process.env.MARKETING_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!base || !secret) {
    logger.error('revalidateMarketingPricing: MARKETING_URL or REVALIDATE_SECRET not set — skipping revalidation')
    return
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ kind: 'plans' }),
      cache: 'no-store',
    })
    if (!res.ok) logger.error(`revalidateMarketingPricing: ${res.status} ${await res.text().catch(() => '')}`)
  } catch (err) {
    logger.error('revalidateMarketingPricing request failed', err)
  }
}
