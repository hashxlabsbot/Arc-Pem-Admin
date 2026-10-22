/**
 * POST /api/payments/webhook
 *
 * Razorpay calls this endpoint server-to-server when a payment is captured.
 * Configure a SECOND webhook URL in the Razorpay dashboard pointing here:
 *   https://<admin-domain>/api/payments/webhook
 * Subscribe to `order.paid` (includes order.notes), `subscription.charged` (ARC PEM auto-renewing subscriptions)
 * and `refund.processed`.
 *
 * The website never calls this — Razorpay calls both endpoints independently.
 * Trust comes entirely from the HMAC signature, not from any inter-service URL.
 *
 * What this does:
 *   1. Verify Razorpay webhook HMAC signature
 *   2. Extract userId, planId from order.notes (set server-side in create-order)
 *   3. Cross-check captured amount against plan price in DB
 *   4. Idempotently upsert PendingPayment → approved
 *   5. Update user.planId if not already set
 *   6. Upsert Client record (licensing side)
 *   7. Generate GST invoice
 *   8. Send plan-activation email
 *
 * Idempotency: keyed on razorpay_payment_id stored in PendingPayment.utr.
 * The website's own webhook may activate the same payment first (status:'paid');
 * this endpoint promotes it to 'approved' and adds the Client + invoice.
 * A true race between the two webhooks is safe — only one will create the row.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'
import { generateInvoiceForPayment } from '@/lib/invoice'
import { annualPrice, planExpiryAfterPayment } from '@/lib/pricing'
import {
  activateWebTerm,
  deliverOutbox,
  enqueueSubscriptionUpdated,
  isDuplicatePayment,
  readSubscriptionCharge,
  type RazorpayPaymentEntity,
  type RazorpaySubscriptionEntity,
} from '@/lib/web-app'
import type { BillingInterval, SeatAddons } from '@/lib/pricing'
import type { Plan, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

// Razorpay requires reading the raw body for HMAC verification — must not parse JSON first.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not configured')
    // Return 200 so Razorpay doesn't retry forever; log for ops to fix.
    return NextResponse.json({ received: true, warning: 'webhook not configured' })
  }

  // ── 1. Verify HMAC signature ─────────────────────────────────────────────
  const rawBody  = await req.text()
  const provided = req.headers.get('x-razorpay-signature') ?? ''
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    console.warn('[webhook] signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = event.event as string | undefined

  // Refunds of ARC PEM Web payments take the paid year back (subscribe to refund.processed in Razorpay).
  if (type === 'refund.processed') {
    const refund = ((event.payload as Record<string, unknown> | undefined)?.refund as { entity?: Record<string, unknown> })?.entity
    try {
      const result = await reverseWebPaymentOnRefund(String(refund?.payment_id ?? ''), Number(refund?.amount ?? 0))
      return NextResponse.json({ received: true, result })
    } catch (err) {
      console.error('[webhook] refund handling failed:', err)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  }

  // ARC PEM subscriptions: every charge (first and renewals) is approved and invoiced here, and applied exactly once
  // whichever of the two webhooks gets it first. Renewal state changes (cancelled, halted…) are the website's job.
  // Subscribe to subscription.charged in Razorpay for this endpoint.
  if (type === 'subscription.charged') {
    const p = event.payload as Record<string, { entity?: unknown }> | undefined
    const subscription = p?.subscription?.entity as RazorpaySubscriptionEntity | undefined
    const payment = p?.payment?.entity as RazorpayPaymentEntity | undefined
    if (!subscription?.id || !payment?.id) return NextResponse.json({ received: true })
    return handleSubscriptionCharge(subscription, payment)
  }

  // We only act on order.paid — it carries both payment entity AND order entity
  // (which has the server-set notes with userId + planId). Acknowledge everything
  // else so Razorpay stops retrying events we don't handle.
  if (type !== 'order.paid') {
    return NextResponse.json({ received: true })
  }

  // ── 3. Extract identifiers from the payload ───────────────────────────────
  const payload     = event.payload as Record<string, unknown> | undefined
  const paymentObj  = (payload?.payment as { entity?: Record<string, unknown> })?.entity
  const orderObj    = (payload?.order   as { entity?: Record<string, unknown> })?.entity

  const paymentId   = paymentObj?.id as string | undefined
  // A subscription charge also raises order.paid (for its invoice's order); subscription.charged handles it.
  if (paymentObj?.invoice_id || paymentObj?.subscription_id) return NextResponse.json({ received: true })
  const amountPaise = Number(paymentObj?.amount ?? 0)
  const notes       = (orderObj?.notes ?? {}) as Record<string, string>
  const userId      = notes.userId
  const planId      = notes.planId
  const planName    = notes.planName ?? ''

  if (!paymentId || !userId || !planId) {
    console.warn('[webhook] missing paymentId / userId / planId in order.paid payload', { paymentId, userId, planId })
    // Acknowledge: a retry won't fix a malformed payload.
    return NextResponse.json({ received: true })
  }

  // ── 4. Idempotency check ─────────────────────────────────────────────────
  const existing = await db.pendingPayment.findFirst({ where: { utr: paymentId } })
  if (existing?.status === 'approved') {
    // Already fully processed — Razorpay retried; safe to ack.
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  // ── 5. Validate plan + amount ─────────────────────────────────────────────
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) {
    console.error('[webhook] plan not found', { planId })
    return NextResponse.json({ received: true })
  }
  // Sold as a one-year license: the website charges 12× the stored monthly base.
  const yearly = annualPrice(plan.price)
  if (amountPaise !== Math.round(yearly * 100)) {
    console.warn('[webhook] amount mismatch', { amountPaise, expected: Math.round(yearly * 100) })
    return NextResponse.json({ received: true })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    console.error('[webhook] user not found', { userId })
    return NextResponse.json({ received: true })
  }

  // ── 6a. ARC PEM Web plan: a firm subscription, not a desktop license ─────
  // No User.planId, no Client/licensing record. The paid year is applied exactly once whichever of the two
  // Razorpay webhooks (website's or this one) gets here first; the web app is then told about it.
  if (plan.product === 'WEB') {
    let paymentDbId: string
    let webEventId: string | null = null
    try {
      ;({ paymentDbId, webEventId } = await recordWebPayment({ existingId: existing?.id, userId, plan, yearly, paymentId }))
    } catch (err) {
      console.error('[webhook] web plan activation failed:', err)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    await logActivity('APPROVE', 'Payment', paymentDbId, `Razorpay webhook approved ${plan.name} (ARC PEM Web) for ${user.email}`)
    if (webEventId) await deliverOutbox({ ids: [webEventId] }).catch((err) => console.error('[webhook] web-app delivery failed (will retry):', err))
    await sendInvoiceAndEmail({ paymentDbId, userId, user, planName: plan.name || planName, yearly, product: 'WEB' })
    return NextResponse.json({ received: true })
  }

  // ── 6. Upsert PendingPayment + activate plan ─────────────────────────────
  // The website's webhook may have already created the row (status:'paid').
  // We upsert so both paths are idempotent regardless of arrival order.
  let paymentDbId: string
  try {
    if (existing) {
      await db.pendingPayment.update({ where: { id: existing.id }, data: { status: 'approved' } })
      paymentDbId = existing.id
    } else {
      const created = await db.pendingPayment.create({
        data: {
          userId,
          planId:   plan.id,
          planName: plan.name || planName,
          amount:   yearly,
          utr:      paymentId,
          status:   'approved',
        },
      })
      paymentDbId = created.id
    }

    // Activate the plan and (re)set the one-year license term. The website may
    // have set planId already but cannot set planExpiresAt, so always write it.
    await db.user.update({
      where: { id: userId },
      data: {
        planId: plan.id,
        planExpiresAt: planExpiryAfterPayment(user.planExpiresAt),
      },
    })
  } catch (err) {
    console.error('[webhook] DB write failed:', err)
    // Return 500 → Razorpay will retry (transient DB issue).
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  await logActivity('APPROVE', 'Payment', paymentDbId, `Razorpay webhook approved ${plan.name} for ${user.email}`)

  // ── 7. Upsert Client (licensing side) ─────────────────────────────────────
  let clientId: string | undefined
  try {
    const billing = await db.billingProfile.findUnique({ where: { userId } })
    const address = billing
      ? [
          billing.addressLine1,
          billing.addressLine2,
          `${billing.city}, ${billing.state} - ${billing.pincode}`,
          billing.country,
        ]
          .filter(Boolean)
          .join(', ')
      : undefined

    const existingClient = await db.client.findUnique({ where: { email: user.email }, select: { id: true } })
    const client = await db.client.upsert({
      where:  { email: user.email },
      create: {
        name:          user.name,
        email:         user.email,
        company:       billing?.legalName ?? null,
        address:       address ?? null,
        plan:          plan.name.toLowerCase(),
        status:        'active',
        paymentStatus: 'paid',
      },
      update: {
        plan:          plan.name.toLowerCase(),
        status:        'active',
        paymentStatus: 'paid',
        ...(billing?.legalName ? { company: billing.legalName } : {}),
        ...(address ? { address } : {}),
      },
    })
    clientId = client.id

    // Link any orphan license requests that arrived before the client was created.
    await db.licenseRequest.updateMany({
      where: { email: user.email, clientId: null },
      data:  { clientId: client.id },
    })

    await logActivity(
      existingClient ? 'UPDATE' : 'CREATE',
      'Client',
      client.id,
      `${existingClient ? 'Updated' : 'Created'} client via Razorpay webhook for ${user.email}`,
    )
  } catch (err) {
    console.error('[webhook] client upsert failed:', err)
  }

  // ── 8–9. GST invoice + activation email ───────────────────────────────────
  await sendInvoiceAndEmail({ paymentDbId, userId, user, planName: plan.name || planName, yearly, product: 'DESKTOP' })

  return NextResponse.json({ received: true, clientId })
}

/**
 * A full refund of a web-plan payment takes back the time it bought: the subscription's end moves back by that
 * term's length, and a subscription with no paid time left is cancelled. Partial refunds are left to staff (logged),
 * since what they should buy back is a business decision. Idempotent: the payment row is marked 'refunded' in the
 * same transaction, and a refund for a payment already marked is ignored.
 */
async function reverseWebPaymentOnRefund(paymentId: string, refundPaise: number) {
  if (!paymentId) return 'ignored'
  const term = await db.webSubscriptionPayment.findUnique({ where: { paymentRef: paymentId } })
  if (!term) return 'not_web' // desktop payments: handled by staff as before
  if (Math.round(term.amount * 100) > refundPaise) {
    await logActivity('REFUND', 'WebSubscription', term.subscriptionId, `Partial refund of ${paymentId} (₹${refundPaise / 100}); review the term manually`)
    return 'partial_logged'
  }
  const eventId = await db.$transaction(async (tx) => {
    const { count } = await tx.pendingPayment.updateMany({
      where: { utr: paymentId, status: { not: 'refunded' } },
      data: { status: 'refunded' },
    })
    if (count === 0) return null
    const sub = await tx.webSubscription.findUniqueOrThrow({ where: { id: term.subscriptionId } })
    const termMs = term.periodEnd.getTime() - term.periodStart.getTime()
    const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd.getTime() - termMs) : null
    const stillPaid = end !== null && end > new Date()
    await tx.webSubscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: end, status: stillPaid ? sub.status : 'CANCELED', updatedAt: new Date() },
    })
    return enqueueSubscriptionUpdated(tx, sub.id)
  })
  if (!eventId) return 'already_refunded'
  await deliverOutbox({ ids: [eventId] }).catch((err) => console.error('[webhook] web-app delivery failed (will retry):', err))
  await logActivity('REFUND', 'WebSubscription', term.subscriptionId, `Full refund of ${paymentId}; term reversed`)
  return 'reversed'
}

/**
 * Marks a web-plan payment approved and applies its paid year, unless the website's webhook already applied it.
 * Returns the outbox event to deliver (null when nothing new was applied).
 */
async function recordWebPayment({
  existingId,
  userId,
  plan,
  yearly,
  paymentId,
  interval,
  razorpay,
  addons,
}: {
  existingId?: string
  userId: string
  plan: Plan
  /** The amount paid (₹): a year for one-off payments, one cycle for subscription charges. */
  yearly: number
  paymentId: string
  interval?: BillingInterval
  razorpay?: { subscriptionId: string; firstCharge: boolean }
  addons?: SeatAddons
}): Promise<{ paymentDbId: string; webEventId: string | null }> {
  const approve = async (tx: Prisma.TransactionClient | typeof db) => {
    const row = existingId ? { id: existingId } : await tx.pendingPayment.findFirst({ where: { utr: paymentId } })
    if (row) return (await tx.pendingPayment.update({ where: { id: row.id }, data: { status: 'approved' } })).id
    return (
      await tx.pendingPayment.create({
        data: { userId, planId: plan.id, planName: plan.name, amount: yearly, utr: paymentId, status: 'approved' },
      })
    ).id
  }
  try {
    return await db.$transaction(async (tx) => {
      const paymentDbId = await approve(tx)
      const applied = await tx.webSubscriptionPayment.findUnique({ where: { paymentRef: paymentId } })
      const term = applied ? null : await activateWebTerm(tx, { userId, plan, paymentRef: paymentId, amount: yearly, interval, razorpay, addons })
      return { paymentDbId, webEventId: term?.eventId ?? null }
    })
  } catch (err) {
    // The website applied the same payment at the same moment (paymentRef is unique): only approve it here.
    if (!isDuplicatePayment(err)) throw err
    return { paymentDbId: await approve(db), webEventId: null }
  }
}

/** One charge of an auto-renewing ARC PEM subscription: approve it, apply its month or year, invoice it. */
async function handleSubscriptionCharge(subscription: RazorpaySubscriptionEntity, payment: RazorpayPaymentEntity) {
  const existing = await db.pendingPayment.findFirst({ where: { utr: payment.id } })
  if (existing?.status === 'approved') return NextResponse.json({ received: true, alreadyProcessed: true })

  const charge = await readSubscriptionCharge(db, subscription, payment)
  if (!charge.ok) {
    console.warn('[webhook] subscription charge rejected', { subscriptionId: subscription.id, paymentId: payment.id, reason: charge.reason })
    return NextResponse.json({ received: true })
  }
  const user = await db.user.findUnique({ where: { id: charge.userId } })
  if (!user) return NextResponse.json({ received: true })

  let paymentDbId: string
  let webEventId: string | null = null
  try {
    ;({ paymentDbId, webEventId } = await recordWebPayment({
      existingId: existing?.id,
      userId: user.id,
      plan: charge.plan,
      yearly: charge.amount,
      paymentId: payment.id,
      interval: charge.interval,
      razorpay: { subscriptionId: subscription.id, firstCharge: charge.firstCharge },
      addons: charge.addons,
    }))
  } catch (err) {
    console.error('[webhook] subscription charge activation failed:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  const cycle = charge.interval === 'MONTH' ? 'monthly' : 'annual'
  await logActivity('APPROVE', 'Payment', paymentDbId, `Razorpay ${cycle} subscription charge for ${charge.plan.name} (${user.email})`)
  if (webEventId) await deliverOutbox({ ids: [webEventId] }).catch((err) => console.error('[webhook] web-app delivery failed (will retry):', err))
  await sendInvoiceAndEmail({ paymentDbId, userId: user.id, user, planName: charge.plan.name, yearly: charge.amount, product: 'WEB' })
  return NextResponse.json({ received: true })
}

async function sendInvoiceAndEmail({
  paymentDbId,
  userId,
  user,
  planName,
  yearly,
  product,
}: {
  paymentDbId: string
  userId: string
  user: { email: string; name: string }
  planName: string
  yearly: number
  product: 'DESKTOP' | 'WEB'
}) {
  let invoiceAttachment: { fileName: string; pdf: Uint8Array } | undefined
  try {
    const result = await generateInvoiceForPayment({ id: paymentDbId, userId, planName, amount: yearly })
    if (result.ok) {
      invoiceAttachment = { fileName: result.fileName, pdf: result.pdf }
      await logActivity('INVOICE_GENERATED', 'Invoice', result.invoiceId, `Invoice ${result.invoiceNumber} for ${user.email}`)
    }
  } catch (err) {
    console.error('[webhook] invoice generation failed:', err)
  }

  try {
    await sendApprovalEmail({ to: user.email, name: user.name, planName, invoice: invoiceAttachment, product })
  } catch (err) {
    console.error('[webhook] approval email failed:', err)
  }
}
