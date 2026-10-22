import type { Prisma } from '@prisma/client'

/**
 * Filters for the firms list (?state=):
 *   trial | paying | renewal_off (paid, auto-renew off) | past_due | lapsed (term ended) | suspended (suspended or cancelled)
 */
export function firmFilter(params: URLSearchParams, now = new Date()): Prisma.WebSubscriptionWhereInput {
  const search = params.get('search')?.trim()
  const planId = params.get('plan') || undefined
  const and: Prisma.WebSubscriptionWhereInput[] = []
  if (search)
    and.push({
      OR: [
        { firmName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { razorpaySubscriptionId: search },
      ],
    })
  if (planId) and.push({ planId })
  const running: Prisma.WebSubscriptionWhereInput = {
    status: { notIn: ['SUSPENDED', 'CANCELED'] },
    OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
  }
  switch (params.get('state')) {
    case 'trial': and.push(running, { trialEndsAt: { not: null } }); break
    case 'paying': and.push(running, { trialEndsAt: null, payments: { some: {} } }); break
    case 'renewal_off': and.push(running, { trialEndsAt: null, autoRenew: false }); break
    case 'past_due': and.push({ status: 'PAST_DUE' }); break
    case 'lapsed': and.push({ currentPeriodEnd: { lte: now } }); break
    case 'suspended': and.push({ status: { in: ['SUSPENDED', 'CANCELED'] } }); break
  }
  return and.length ? { AND: and } : {}
}
