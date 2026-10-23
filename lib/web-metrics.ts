import { db } from '@/lib/db'
import { getBillingRules } from '@/lib/billing-rules'
import { subscriptionPrice, type BillingInterval } from '@/lib/pricing'

const DAY = 86_400_000

export type WebMetrics = {
  /** Monthly recurring revenue (₹, before GST) from firms whose auto-renew is on and who have paid at least once. */
  mrr: number
  arr: number
  payingFirms: number
  trials: number
  /** Trials that end within 3 days (the first charge is near). */
  trialsEndingSoon: number
  pastDue: number
  /** Paid firms with auto-renew off whose time runs out within 30 days. */
  atRisk: number
  /** Firms whose paid time ended: read-only (after any grace) until they renew. */
  lapsed: number
  totalFirms: number
  newThisMonth: number
  revenueThisMonth: number
  revenueLastMonth: number
  byPlan: { name: string; tier: string | null; firms: number; mrr: number }[]
}

/**
 * Subscription health for ARC PEM, computed from the firm subscriptions and their payments. MRR counts what each
 * renewing firm will be charged per month (annual plans spread over 12 months), at today's billing rules.
 */
export async function webMetrics(now = new Date()): Promise<WebMetrics> {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [subs, rules, thisMonth, lastMonth] = await Promise.all([
    db.webSubscription.findMany({ include: { plan: true, _count: { select: { payments: true } } } }),
    getBillingRules(),
    db.webSubscriptionPayment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: startOfMonth } } }),
    db.webSubscriptionPayment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: startOfLast, lt: startOfMonth } } }),
  ])

  const m: WebMetrics = {
    mrr: 0, arr: 0, payingFirms: 0, trials: 0, trialsEndingSoon: 0, pastDue: 0, atRisk: 0, lapsed: 0,
    totalFirms: subs.length, newThisMonth: 0,
    revenueThisMonth: thisMonth._sum.amount ?? 0, revenueLastMonth: lastMonth._sum.amount ?? 0, byPlan: [],
  }
  const plans = new Map<string, { name: string; tier: string | null; firms: number; mrr: number }>()

  for (const s of subs) {
    if (s.createdAt >= startOfMonth) m.newThisMonth++
    const end = s.currentPeriodEnd
    const running = s.status !== 'SUSPENDED' && s.status !== 'CANCELED' && (!end || end > now)
    const trial = Boolean(s.trialEndsAt) && running
    if (trial) {
      m.trials++
      if (end && end.getTime() - now.getTime() < 3 * DAY) m.trialsEndingSoon++
    }
    if (s.status === 'PAST_DUE') m.pastDue++
    if (!running && s._count.payments > 0) m.lapsed++
    if (running && !trial && !s.autoRenew && end && end.getTime() - now.getTime() < 30 * DAY) m.atRisk++

    const paying = running && !trial && s._count.payments > 0
    if (!paying) continue
    m.payingFirms++
    const p = plans.get(s.planId) ?? { name: s.plan.name.replace(/^web\s+/i, ''), tier: s.plan.tier, firms: 0, mrr: 0 }
    p.firms++
    if (s.autoRenew) {
      const interval = (s.billingInterval === 'MONTH' ? 'MONTH' : 'YEAR') as BillingInterval
      const cycle = subscriptionPrice(s.plan.price, interval, { seats: s.extraSeats, siteSeats: s.extraSiteSeats }, rules)
      const monthly = interval === 'MONTH' ? cycle : cycle / 12
      m.mrr += monthly
      p.mrr += monthly
    }
    plans.set(s.planId, p)
  }
  m.mrr = Math.round(m.mrr)
  m.arr = m.mrr * 12
  m.byPlan = Array.from(plans.values()).map((p) => ({ ...p, mrr: Math.round(p.mrr) })).sort((a, b) => b.mrr - a.mrr)
  return m
}
