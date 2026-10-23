/**
 * ARC PEM Web (app.arcpem.com): firm subscriptions and keeping the web app told about them.
 *
 * The web app has its own database. It learns about a firm's plan two ways, both carrying the same shape (the
 * contract lives in the web app at src/lib/accounts/contract.ts):
 *   - at owner sign-in, inside the ID token this site issues (lib/oidc.ts), and
 *   - after every change, as a signed `subscription.updated` event. Events are written to WebhookOutbox in the same
 *     transaction as the change and delivered afterwards with retries, so a change is never lost if the web app is
 *     briefly unreachable. Each event carries the full current state, so order and repeats don't matter.
 *
 * The customer website (Arch-Pem-Website-User, lib/web-app.ts) has a copy of this file; keep the two in step.
 */
import { createHmac, randomBytes } from 'crypto'
import { Prisma, type Plan, type WebSubscription } from '@prisma/client'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { chargePaise, isBillingInterval, NO_ADDONS, subscriptionPrice, type BillingInterval, type SeatAddons } from '@/lib/pricing'
import { getBillingRules } from '@/lib/billing-rules'

export const WEB_TIERS = ['SOLO', 'STUDIO', 'BUSINESS', 'ENTERPRISE'] as const

/** The app's ceiling for a limit; also what "unlimited" is stored as. */
export const UNLIMITED = 100_000
const capLimit = (n: number) => Math.min(n, UNLIMITED)

type SubscriptionWithPlan = WebSubscription & { plan: Plan }

/** The subscription in the shape the web app expects. Limits are explicit, so admin's plan settings are the truth. */
export function subscriptionState(sub: SubscriptionWithPlan) {
  return {
    plan: sub.plan.tier,
    status: sub.status,
    ends_at: sub.currentPeriodEnd?.toISOString() ?? null,
    seats: sub.seatLimit ?? sub.plan.maxUsers,
    projects: sub.projectLimit ?? sub.plan.maxProjects,
    site_seats: sub.siteSeatLimit ?? sub.plan.maxSiteUsers,
    billing_interval: sub.billingInterval,
    auto_renew: sub.autoRenew,
    // Nothing paid yet: the app gives a trial that ends unpaid no grace period.
    trial: Boolean(sub.trialEndsAt),
    updated_at: sub.updatedAt.toISOString(),
  }
}

/** Queues the current state of a subscription for delivery, inside the caller's transaction. Returns the event id. */
export async function enqueueSubscriptionUpdated(tx: Prisma.TransactionClient, subscriptionId: string) {
  const sub = await tx.webSubscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { plan: true } })
  const id = `evt_${randomBytes(12).toString('hex')}`
  const payload = {
    id,
    type: 'subscription.updated',
    created_at: new Date().toISOString(),
    data: { account: { id: sub.userId, name: sub.firmName }, subscription: subscriptionState(sub) },
  }
  await tx.webhookOutbox.create({ data: { id, type: payload.type, payload } })
  return id
}

/** The end of one billing cycle that starts at `d`. Month ends clamp (31 Jan + 1 month = 28/29 Feb). */
export function addInterval(d: Date, interval: BillingInterval) {
  const next = new Date(d)
  if (interval === 'YEAR') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
    return next
  }
  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next
}

/**
 * The firm's limits for a plan bought with add-on seats. With no add-ons the plan's own limits apply (null), which
 * also clears limits left over from an earlier subscription. Custom deals are set by staff in the admin app.
 */
function addonLimits(plan: Plan, addons: SeatAddons) {
  return {
    extraSeats: addons.seats,
    extraSiteSeats: addons.siteSeats,
    seatLimit: addons.seats ? capLimit(plan.maxUsers + addons.seats) : null,
    siteSeatLimit: addons.siteSeats ? capLimit(plan.maxSiteUsers + addons.siteSeats) : null,
  }
}

/** Add-on seats from a subscription's server-set notes; anything malformed counts as none. */
export function readAddons(notes: Record<string, string>): SeatAddons {
  // Bounded only for sanity: checkout enforces the configured maximum when the subscription is created.
  const n = (v: string | undefined) => {
    const x = Number(v ?? 0)
    return Number.isInteger(x) && x >= 0 && x <= 10_000 ? x : 0
  }
  return { seats: n(notes.extraSeats), siteSeats: n(notes.extraSiteSeats) }
}

/**
 * Applies one paid cycle (a month or a year) of a web plan, inside the caller's transaction. Renewal-safe: a cycle
 * paid while the current one is still running starts when it ends. `paymentRef` is unique in WebSubscriptionPayment,
 * so the same payment reported twice (this site and the admin app both hear from Razorpay) raises P2002 and the
 * caller's transaction rolls back: see isDuplicatePayment.
 *
 * With `razorpay`, the payment is a charge of a recurring Razorpay subscription. Its first charge makes it the firm's
 * subscription (plan, interval, auto-renew on); later charges of a subscription that has since been replaced still
 * extend the paid time but never switch the firm back to the old plan.
 */
export async function activateWebTerm(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    plan: Plan
    paymentRef: string
    amount: number
    interval?: BillingInterval
    razorpay?: { subscriptionId: string; firstCharge: boolean }
    /** Add-on seats bought with this subscription; they set the firm's limits when the subscription takes over. */
    addons?: SeatAddons
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  const interval = input.interval ?? 'YEAR'
  if (input.plan.product !== 'WEB' || !input.plan.tier) throw new Error(`Plan ${input.plan.id} is not a web plan`)
  const [existing, user] = await Promise.all([
    tx.webSubscription.findUnique({ where: { userId: input.userId } }),
    tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { name: true, billingProfile: { select: { legalName: true } } },
    }),
  ])
  // Paid time still to run is kept, including while a renewal is being retried (PAST_DUE).
  const running =
    (existing?.status === 'ACTIVE' || existing?.status === 'PAST_DUE') &&
    existing.currentPeriodEnd &&
    existing.currentPeriodEnd > now
  const periodStart = running ? existing!.currentPeriodEnd! : now
  const periodEnd = addInterval(periodStart, interval)

  const rzp = input.razorpay
  const current = existing?.razorpaySubscriptionId ?? null
  // Does this payment decide the firm's plan? One-off payments always do; a recurring charge does when it is the
  // firm's current subscription, or the first charge of a new one (a plan switch).
  const takesOver = !rzp || !current || current === rzp.subscriptionId || rzp.firstCharge
  const addons = input.addons ?? NO_ADDONS
  const limits = addonLimits(input.plan, addons)
  const planFields = takesOver
    ? {
        planId: input.plan.id,
        billingInterval: interval,
        autoRenew: Boolean(rzp),
        razorpaySubscriptionId: rzp ? rzp.subscriptionId : null,
        ...(rzp ? limits : {}),
        trialEndsAt: null,
      }
    : {}

  const sub = await tx.webSubscription.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      firmName: user.billingProfile?.legalName ?? user.name,
      planId: input.plan.id,
      status: 'ACTIVE',
      currentPeriodEnd: periodEnd,
      billingInterval: interval,
      autoRenew: Boolean(rzp),
      razorpaySubscriptionId: rzp?.subscriptionId ?? null,
      ...limits,
    },
    update: { ...planFields, status: 'ACTIVE', currentPeriodEnd: periodEnd },
  })
  await tx.webSubscriptionPayment.create({
    data: {
      subscriptionId: sub.id,
      paymentRef: input.paymentRef,
      planId: input.plan.id,
      amount: input.amount,
      periodStart,
      periodEnd,
    },
  })
  const eventId = await enqueueSubscriptionUpdated(tx, sub.id)
  return { subscriptionId: sub.id, periodEnd, eventId }
}

/** The parts of Razorpay's subscription and payment entities that billing relies on. */
export type RazorpaySubscriptionEntity = {
  id: string
  status: string
  paid_count?: number
  notes?: Record<string, string> | unknown[]
}
export type RazorpayPaymentEntity = { id: string; amount: number | string; currency: string; status: string }

export type SubscriptionCharge =
  | { ok: true; userId: string; plan: Plan; interval: BillingInterval; addons: SeatAddons; amount: number; firstCharge: boolean }
  | { ok: false; reason: string }

/**
 * Checks a captured charge of a Razorpay subscription and works out what it pays for. The firm, plan and interval
 * come only from the subscription's notes, which this site writes when it creates the subscription; the amount must
 * be the plan's price for that interval plus GST.
 */
export async function readSubscriptionCharge(
  client: Prisma.TransactionClient | typeof db,
  subscription: RazorpaySubscriptionEntity,
  payment: RazorpayPaymentEntity,
): Promise<SubscriptionCharge> {
  const notes = (Array.isArray(subscription.notes) ? {} : subscription.notes ?? {}) as Record<string, string>
  const { userId, planId } = notes
  const interval = notes.interval
  if (!userId || !planId || !isBillingInterval(interval)) return { ok: false, reason: 'subscription has no ARC PEM notes' }
  if (payment.status !== 'captured') return { ok: false, reason: `payment ${payment.status}` }
  if (payment.currency !== 'INR') return { ok: false, reason: 'unsupported currency' }
  const plan = await client.plan.findUnique({ where: { id: planId } })
  if (!plan || plan.product !== 'WEB') return { ok: false, reason: 'not a web plan' }
  const paid = Number(payment.amount)
  // The Razorpay plan behind a subscription fixes its price when it is sold, so accept that price as well as today's.
  const sold = await client.razorpayPlan.findFirst({ where: { planId, billingInterval: interval, amountPaise: paid } })
  const addons = readAddons(notes)
  if (!sold && paid !== chargePaise(subscriptionPrice(plan.price, interval, addons, await getBillingRules(client)))) {
    return { ok: false, reason: 'amount does not match the plan price' }
  }
  return { ok: true, userId, plan, interval, addons, amount: paid / 100, firstCharge: (subscription.paid_count ?? 1) <= 1 }
}

/** A firm's first subscription may start with a free trial; anyone who has subscribed before pays from day one. */
export async function trialEligible(client: Prisma.TransactionClient | typeof db, userId: string) {
  return !(await client.webSubscription.findUnique({ where: { userId }, select: { id: true } }))
}

/**
 * Starts the free trial of a subscription whose auto-pay has been set up (Razorpay `authenticated`) but whose
 * first charge is due when the trial ends. The firm gets the plan straight away; that first charge then extends it
 * from the trial's end. Idempotent, and a no-op for anyone who has had a subscription before.
 * Returns the outbox event to deliver, or null.
 */
export async function startTrial(
  tx: Prisma.TransactionClient,
  input: { subscription: RazorpaySubscriptionEntity; trialEndsAt: Date },
) {
  const notes = (Array.isArray(input.subscription.notes) ? {} : input.subscription.notes ?? {}) as Record<string, string>
  const { userId, planId } = notes
  if (!userId || !planId || notes.trial !== '1' || !isBillingInterval(notes.interval)) return null
  const existing = await tx.webSubscription.findUnique({ where: { userId } })
  if (existing) return null
  const [plan, user] = await Promise.all([
    tx.plan.findUnique({ where: { id: planId } }),
    tx.user.findUnique({ where: { id: userId }, select: { name: true, billingProfile: { select: { legalName: true } } } }),
  ])
  if (!plan || plan.product !== 'WEB' || !plan.tier || !user) return null
  const sub = await tx.webSubscription.create({
    data: {
      userId,
      firmName: user.billingProfile?.legalName ?? user.name,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodEnd: input.trialEndsAt,
      trialEndsAt: input.trialEndsAt,
      billingInterval: notes.interval,
      autoRenew: true,
      razorpaySubscriptionId: input.subscription.id,
      ...addonLimits(plan, readAddons(notes)),
    },
  })
  return enqueueSubscriptionUpdated(tx, sub.id)
}

/**
 * A Razorpay subscription changed state without a payment. Only the firm's current subscription counts; events
 * about one it has replaced are ignored. Cancelling stops renewals but keeps the time already paid for.
 * Returns the outbox event to deliver, or null when nothing changed.
 */
export async function applyRenewalChange(
  tx: Prisma.TransactionClient,
  razorpaySubscriptionId: string,
  change: 'cancelled' | 'completed' | 'halted' | 'pending',
) {
  const sub = await tx.webSubscription.findUnique({ where: { razorpaySubscriptionId } })
  if (!sub) return null
  const data =
    change === 'pending'
      ? { status: 'PAST_DUE' }
      : change === 'halted'
        ? { status: 'PAST_DUE', autoRenew: false }
        : { autoRenew: false }
  const unchanged = Object.entries(data).every(([k, v]) => sub[k as keyof typeof sub] === v)
  if (unchanged) return null
  await tx.webSubscription.update({ where: { id: sub.id }, data })
  return enqueueSubscriptionUpdated(tx, sub.id)
}

export const isDuplicatePayment = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, as the web app verifies it. */
export function signatureHeader(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

const MAX_ATTEMPTS = 12
const LEASE_MS = 2 * 60_000
/** 30s, 1m, 2m … capped at 6h: about two days of retries before an event is marked FAILED for a human to look at. */
const backoffMs = (attempts: number) => Math.min(30_000 * 2 ** (attempts - 1), 6 * 60 * 60_000)

/**
 * Sends due events to the web app. Safe to run from several places at once (after a change, and from the cron
 * route): each event is leased before sending, and the web app ignores an event id it has already processed.
 */
export async function deliverOutbox({ ids, limit = 20 }: { ids?: string[]; limit?: number } = {}) {
  const url = env.webAppUrl()
  const secret = env.webAppWebhookSecret()
  if (!url || !secret) {
    logger.warn('web-app outbox: WEB_APP_URL / WEB_APP_WEBHOOK_SECRET not set; events stay queued')
    return { delivered: 0, failed: 0, retrying: 0 }
  }
  const due = await db.webhookOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() }, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const counts = { delivered: 0, failed: 0, retrying: 0 }
  for (const event of due) {
    const lease = await db.webhookOutbox.updateMany({
      where: { id: event.id, status: 'PENDING', nextAttemptAt: event.nextAttemptAt },
      data: { nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    })
    if (lease.count === 0) continue

    const body = JSON.stringify(event.payload)
    let error = ''
    let permanent = false
    try {
      const res = await fetch(`${url}/api/webhooks/accounts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-arcpem-signature': signatureHeader(secret, body) },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        error = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`
        // The web app answers 400/401/413 only for a delivery that can never succeed as sent.
        permanent = res.status === 400 || res.status === 401 || res.status === 413
      }
    } catch (err) {
      error = String(err).slice(0, 300)
    }

    const attempts = event.attempts + 1
    if (!error) {
      await db.webhookOutbox.update({
        where: { id: event.id },
        data: { status: 'DELIVERED', attempts, deliveredAt: new Date(), lastError: null },
      })
      counts.delivered++
    } else if (permanent || attempts >= MAX_ATTEMPTS) {
      await db.webhookOutbox.update({ where: { id: event.id }, data: { status: 'FAILED', attempts, lastError: error } })
      logger.error('web-app outbox: event failed permanently', undefined, { id: event.id, error })
      counts.failed++
    } else {
      await db.webhookOutbox.update({
        where: { id: event.id },
        data: { attempts, lastError: error, nextAttemptAt: new Date(Date.now() + backoffMs(attempts)) },
      })
      counts.retrying++
    }
  }
  return counts
}
