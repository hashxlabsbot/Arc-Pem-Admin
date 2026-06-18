/**
 * POST /api/payments/notify
 *
 * Called by the customer website immediately after a Razorpay payment is
 * verified and activated on the website side. The website has already:
 *   1. Verified the Razorpay HMAC signature
 *   2. Confirmed the payment is captured (via Razorpay API)
 *   3. Written a PendingPayment row with status='paid' + updated user.planId
 *
 * This endpoint's job: find that row in the shared DB (proof-of-payment),
 * mirror the user as a Client, generate the GST invoice, and send the
 * activation email. It is idempotent — a webhook re-delivery or double-call
 * returns 200 without doing anything twice.
 *
 * Auth: X-Internal-Key header (shared secret, set in both apps' env as
 *       INTERNAL_API_KEY). CORS-open so the website can call cross-origin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'
import { generateInvoiceForPayment } from '@/lib/invoice'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const internalKey = process.env.INTERNAL_API_KEY
    if (internalKey) {
      if (req.headers.get('x-internal-key') !== internalKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
      }
    }

    const body = await req.json()
    const { paymentId } = body as { paymentId?: string }
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400, headers: CORS_HEADERS })
    }

    // ── Find the PendingPayment already created by the website ────────────────
    // The website stores razorpay_payment_id in the `utr` field with status='paid'.
    const payment = await db.pendingPayment.findFirst({ where: { utr: paymentId } })
    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Idempotent: already promoted to approved.
    if (payment.status === 'approved') {
      return NextResponse.json({ success: true, alreadyProcessed: true }, { headers: CORS_HEADERS })
    }

    if (payment.status !== 'paid') {
      return NextResponse.json(
        { error: `Unexpected payment status: ${payment.status}` },
        { status: 409, headers: CORS_HEADERS },
      )
    }

    // ── Load the buyer ────────────────────────────────────────────────────────
    const user = await db.user.findUnique({ where: { id: payment.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // ── Mark approved ─────────────────────────────────────────────────────────
    await db.pendingPayment.update({ where: { id: payment.id }, data: { status: 'approved' } })
    await logActivity('APPROVE', 'Payment', payment.id, `Auto-approved via Razorpay notify for ${user.email}`)

    // ── Upsert Client (licensing side) ────────────────────────────────────────
    let clientId: string | undefined
    try {
      const billing = await db.billingProfile.findUnique({ where: { userId: user.id } })
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
        where: { email: user.email },
        create: {
          name:          user.name,
          email:         user.email,
          company:       billing?.legalName ?? null,
          address:       address ?? null,
          plan:          payment.planName.toLowerCase(),
          status:        'active',
          paymentStatus: 'paid',
        },
        update: {
          plan:          payment.planName.toLowerCase(),
          status:        'active',
          paymentStatus: 'paid',
          ...(billing?.legalName ? { company: billing.legalName } : {}),
          ...(address ? { address } : {}),
        },
      })
      clientId = client.id

      // Also link any pending license requests from this email to the new client.
      await db.licenseRequest.updateMany({
        where: { email: user.email, clientId: null },
        data:  { clientId: client.id },
      })

      await logActivity(
        existingClient ? 'UPDATE' : 'CREATE',
        'Client',
        client.id,
        `${existingClient ? 'Updated' : 'Created'} client from Razorpay payment ${paymentId}`,
      )
    } catch (err) {
      console.error('[notify] client upsert failed:', err)
    }

    // ── Generate GST invoice ──────────────────────────────────────────────────
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
        invoiceGenerated  = true
        invoiceId         = result.invoiceId
        invoiceAttachment = { fileName: result.fileName, pdf: result.pdf }
        await logActivity('INVOICE_GENERATED', 'Invoice', result.invoiceId, `Invoice ${result.invoiceNumber} for ${user.email}`)
      } else {
        invoiceReason = result.reason
      }
    } catch (err) {
      console.error('[notify] invoice generation failed:', err)
      invoiceReason = err instanceof Error ? err.message : String(err)
    }

    // ── Send activation email ─────────────────────────────────────────────────
    let emailSent = false
    let emailError: string | undefined
    try {
      await sendApprovalEmail({
        to:       user.email,
        name:     user.name,
        planName: payment.planName,
        invoice:  invoiceAttachment,
      })
      emailSent = true
    } catch (err) {
      console.error('[notify] approval email failed:', err)
      emailError = err instanceof Error ? err.message : String(err)
    }

    return NextResponse.json(
      { success: true, clientId, invoiceGenerated, invoiceReason, invoiceId, emailSent, emailError },
      { headers: CORS_HEADERS },
    )
  } catch (err) {
    console.error('[POST /api/payments/notify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
