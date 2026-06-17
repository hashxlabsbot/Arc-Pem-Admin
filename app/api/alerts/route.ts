import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [expired, critical, warning] = await Promise.all([
      db.license.findMany({
        where: {
          status: 'active',
          expiry: { lt: now },
        },
        include: { client: { select: { name: true, email: true } } },
        orderBy: { expiry: 'asc' },
      }),
      db.license.findMany({
        where: {
          status: 'active',
          expiry: { gte: now, lte: in7Days },
        },
        include: { client: { select: { name: true, email: true } } },
        orderBy: { expiry: 'asc' },
      }),
      db.license.findMany({
        where: {
          status: 'active',
          expiry: { gt: in7Days, lte: in30Days },
        },
        include: { client: { select: { name: true, email: true } } },
        orderBy: { expiry: 'asc' },
      }),
    ])

    const total = expired.length + critical.length + warning.length

    return NextResponse.json({ expired, critical, warning, total })
  } catch (err) {
    console.error('[GET /api/alerts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
