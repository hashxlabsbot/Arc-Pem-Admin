import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'
import { generateInvoiceForPayment } from '@/lib/invoice'

// pdf-lib + Prisma Bytes need the Node.js runtime (not Edge).
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paymentId } = await req.json()
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await db.pendingPayment.findUnique({ where: { id: paymentId } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment already processed' }, { status: 409 })
  }

  const user = await db.user.findUnique({ where: { id: payment.userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Activate the plan and mark payment approved atomically
  await db.$transaction([
    db.user.update({
      where: { id: payment.userId },
      data:  { planId: payment.planId },
    }),
    db.pendingPayment.update({
      where: { id: paymentId },
      data:  { status: 'approved' },
    }),
  ])

  await logActivity('APPROVE', 'Payment', paymentId, `Approved ${payment.planName} plan for user ${payment.userId}`)

  // Generate the GST invoice. Never blocks approval — on missing details / errors
  // we report it and let the admin generate later once billing data exists.
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
      invoiceId = result.invoiceId
      invoiceAttachment = { fileName: result.fileName, pdf: result.pdf }
      await logActivity('INVOICE_GENERATED', 'Invoice', result.invoiceId, `Invoice ${result.invoiceNumber} for user ${payment.userId}`)
    } else {
      invoiceReason = result.reason
    }
  } catch (err) {
    console.error('[invoice] generation failed:', err)
    invoiceReason = err instanceof Error ? err.message : String(err)
  }

  // Send activation email (with invoice attached when available) — awaited so errors surface
  try {
    await sendApprovalEmail({
      to:       user.email,
      name:     user.name,
      planName: payment.planName,
      invoice:  invoiceAttachment,
    })
    return NextResponse.json({ success: true, emailSent: true, invoiceGenerated, invoiceReason, invoiceId })
  } catch (err) {
    // Plan is already activated — just report the email failure
    console.error('[email] approval failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      success:   true,
      emailSent: false,
      emailError: message,
      invoiceGenerated,
      invoiceReason,
      invoiceId,
    })
  }
}
