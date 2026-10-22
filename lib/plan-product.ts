export const PRODUCTS = ['DESKTOP', 'WEB'] as const
export const WEB_TIERS = ['SOLO', 'STUDIO', 'BUSINESS', 'ENTERPRISE'] as const

/**
 * Validates a plan's product and tier together (the database enforces the same rule): a WEB plan names the web
 * app's tier it unlocks; a DESKTOP plan has none. Returns the values to store, or an error message.
 */
export function parsePlanProduct(product: unknown, tier: unknown): { product: string; tier: string | null } | { error: string } {
  const p = product === undefined ? 'DESKTOP' : String(product).toUpperCase()
  if (!(PRODUCTS as readonly string[]).includes(p)) return { error: 'product must be DESKTOP or WEB' }
  if (p === 'DESKTOP') return { product: p, tier: null }
  const t = String(tier ?? '').toUpperCase()
  if (!(WEB_TIERS as readonly string[]).includes(t)) return { error: 'A web plan needs a tier: SOLO, STUDIO, BUSINESS or ENTERPRISE' }
  return { product: p, tier: t }
}
