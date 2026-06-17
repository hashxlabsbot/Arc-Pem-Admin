import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paymentId } = await req.json()
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await db.pendingPayment.findUnique({ where: { id: paymentId } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  // Reset payment and remove plan atomically
  await db.$transaction([
    db.pendingPayment.update({
      where: { id: paymentId },
      data:  { status: 'pending' },
    }),
    db.user.update({
      where: { id: payment.userId },
      data:  { planId: null },
    }),
  ])

  await logActivity('RESET', 'Payment', paymentId, `Payment reset to pending, plan removed from user ${payment.userId}`)

  return NextResponse.json({ success: true })
}
