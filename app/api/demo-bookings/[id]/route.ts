import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'CONTACTED']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { status, meetLink } = await req.json()

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const booking = await db.demoBooking.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(meetLink !== undefined ? { meetLink: meetLink || null } : {}),
      },
    })

    await logActivity('UPDATE', 'DemoBooking', booking.id, `Updated demo booking for ${booking.name}`)

    return NextResponse.json({ booking })
  } catch (err) {
    logger.error('PATCH /api/demo-bookings/[id] failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
