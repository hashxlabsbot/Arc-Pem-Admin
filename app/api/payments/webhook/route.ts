/**
 * POST /api/payments/webhook
 *
 * Razorpay calls this endpoint server-to-server when a payment is captured.
 * Configure a SECOND webhook URL in the Razorpay dashboard pointing here:
 *   https://<admin-domain>/api/payments/webhook
 * Subscribe to the `order.paid` event (includes order.notes in the payload).
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

  // ── 8. Generate GST invoice ───────────────────────────────────────────────
  let invoiceAttachment: { fileName: string; pdf: Uint8Array } | undefined
  try {
    const result = await generateInvoiceForPayment({
      id:       paymentDbId,
      userId,
      planName: plan.name || planName,
      amount:   yearly,
    })
    if (result.ok) {
      invoiceAttachment = { fileName: result.fileName, pdf: result.pdf }
      await logActivity('INVOICE_GENERATED', 'Invoice', result.invoiceId, `Invoice ${result.invoiceNumber} for ${user.email}`)
    }
  } catch (err) {
    console.error('[webhook] invoice generation failed:', err)
  }

  // ── 9. Send activation email ──────────────────────────────────────────────
  try {
    await sendApprovalEmail({
      to:       user.email,
      name:     user.name,
      planName: plan.name || planName,
      invoice:  invoiceAttachment,
    })
  } catch (err) {
    console.error('[webhook] approval email failed:', err)
  }

  return NextResponse.json({ received: true, clientId })
}
