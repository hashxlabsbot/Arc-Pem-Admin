import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendRejectionEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paymentId, reason } = await req.json()
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await db.pendingPayment.findUnique({ where: { id: paymentId } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment already processed' }, { status: 409 })
  }

  const user = await db.user.findUnique({ where: { id: payment.userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await db.pendingPayment.update({
    where: { id: paymentId },
    data:  { status: 'rejected' },
  })

  await logActivity('REJECT', 'Payment', paymentId, `Rejected ${payment.planName} plan for user ${payment.userId}`)

  try {
    await sendRejectionEmail({
      to:       user.email,
      name:     user.name,
      planName: payment.planName,
      utr:      payment.utr,
      reason,
    })
    return NextResponse.json({ success: true, emailSent: true })
  } catch (err) {
    console.error('[email] rejection failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      success:   true,
      emailSent: false,
      emailError: message,
    })
  }
}
