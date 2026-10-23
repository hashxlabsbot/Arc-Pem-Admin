import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { deliverOutbox } from '@/lib/web-app'

export const dynamic = 'force-dynamic'

/** Puts every FAILED delivery back in the queue and tries them now (after fixing whatever made them fail). */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { count } = await db.webhookOutbox.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date() },
  })
  const result = await deliverOutbox({ limit: 100 })
  await logActivity('UPDATE', 'WebhookOutbox', undefined, `Retried ${count} failed web-app deliveries`)
  return NextResponse.json({ requeued: count, ...result })
}
