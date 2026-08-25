/**
 * POST /api/payments/submit
 *
 * CORS-open endpoint called by the customer website after a user completes
 * payment. Creates a PendingPayment record and immediately auto-approves it:
 * activates the user's plan, mirrors them as a Client, generates a GST invoice,
 * and sends the activation email — all in one request.
 *
 * Auth: validated via INTERNAL_API_KEY env var (shared secret with the website).
 * This keeps the endpoint open to cross-origin requests while preventing abuse.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'
import { generateInvoiceForPayment } from '@/lib/invoice'
import { verifyInternalKey } from '@/lib/internal-auth'
import { annualPrice } from '@/lib/pricing'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    // Shared-secret guard — website must send INTERNAL_API_KEY in header.
    // Fails closed: an unconfigured secret rejects every request rather than
    // silently allowing them through.
    if (!verifyInternalKey(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json()
    const { userId, planId, utr } = body

    if (!userId || !planId || !utr) {
      return NextResponse.json(
        { error: 'userId, planId, and utr are required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: CORS_HEADERS })
    }

    const plan = await db.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Derived server-side, never from the request body — this endpoint feeds
    // straight into a legally-relevant GST invoice, so the amount/plan name
    // must come from the authoritative Plan record (same convention as
    // /api/payments/webhook's amount cross-check).
    const planName = plan.name
    const amount = annualPrice(plan.price)

    // Reject if user already has an approved payment for this plan to prevent duplicates.
    const existing = await db.pendingPayment.findFirst({
      where: { userId, planId, status: 'approved' },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Payment already approved for this plan' },
        { status: 409, headers: CORS_HEADERS },
      )
    }

    // Create PendingPayment and immediately approve it atomically.
    const payment = await db.pendingPayment.create({
      data: { userId, planId, planName, amount, utr, status: 'pending' },
    })

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { planId } }),
      db.pendingPayment.update({ where: { id: payment.id }, data: { status: 'approved' } }),
    ])

    await logActivity('APPROVE', 'Payment', payment.id, `Auto-approved ${planName} plan for user ${userId}`)

    // Mirror subscriber as a Client so admin can issue a license key.
    let clientId: string | undefined
    try {
      const billing = await db.billingProfile.findUnique({ where: { userId } })
      const address = billing
        ? [billing.addressLine1, billing.addressLine2, `${billing.city}, ${billing.state} - ${billing.pincode}`, billing.country]
            .filter(Boolean)
            .join(', ')
        : undefined
      const planSlug = planName.toLowerCase()

      const existing = await db.client.findUnique({ where: { email: user.email }, select: { id: true } })
      const client = await db.client.upsert({
        where: { email: user.email },
        create: {
          name:          user.name,
          email:         user.email,
          company:       billing?.legalName ?? null,
          address:       address ?? null,
          plan:          planSlug,
          status:        'active',
          paymentStatus: 'paid',
        },
        update: {
          plan:          planSlug,
          status:        'active',
          paymentStatus: 'paid',
          ...(billing?.legalName ? { company: billing.legalName } : {}),
          ...(address ? { address } : {}),
        },
      })
      clientId = client.id
      await logActivity(
        existing ? 'UPDATE' : 'CREATE',
        'Client',
        client.id,
        `${existing ? 'Updated' : 'Created'} client from auto-approved payment for ${user.email}`,
      )
    } catch (err) {
      console.error('[submit-payment] client upsert failed:', err)
    }

    // Generate GST invoice — never blocks the response on failure.
    let invoiceGenerated = false
    let invoiceReason: string | undefined
    let invoiceId: string | undefined
    let invoiceAttachment: { fileName: string; pdf: Uint8Array } | undefined
    try {
      const result = await generateInvoiceForPayment({
        id:       payment.id,
        userId:   payment.userId,
        planName: payment.planName,
        amount:   payment.amount,
      })
      if (result.ok) {
        invoiceGenerated = true
        invoiceId        = result.invoiceId
        invoiceAttachment = { fileName: result.fileName, pdf: result.pdf }
        await logActivity('INVOICE_GENERATED', 'Invoice', result.invoiceId, `Invoice ${result.invoiceNumber} for user ${userId}`)
      } else {
        invoiceReason = result.reason
      }
    } catch (err) {
      console.error('[submit-payment] invoice generation failed:', err)
      invoiceReason = err instanceof Error ? err.message : String(err)
    }

    // Send activation email with invoice attached when available.
    try {
      await sendApprovalEmail({
        to:       user.email,
        name:     user.name,
        planName: payment.planName,
        invoice:  invoiceAttachment,
      })
      return NextResponse.json(
        { success: true, paymentId: payment.id, clientId, invoiceGenerated, invoiceReason, invoiceId, emailSent: true },
        { headers: CORS_HEADERS },
      )
    } catch (err) {
      console.error('[submit-payment] approval email failed:', err)
      return NextResponse.json(
        {
          success: true,
          paymentId: payment.id,
          clientId,
          invoiceGenerated,
          invoiceReason,
          invoiceId,
          emailSent: false,
          emailError: err instanceof Error ? err.message : String(err),
        },
        { headers: CORS_HEADERS },
      )
    }
  } catch (err) {
    console.error('[POST /api/payments/submit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
