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
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [totalClients, activeClients, totalLicenses, activeLicenses, expiringSoon, totalApiKeys] =
      await Promise.all([
        db.client.count(),
        db.client.count({ where: { status: 'active' } }),
        db.license.count(),
        db.license.count({ where: { status: 'active' } }),
        db.license.count({
          where: {
            status: 'active',
            expiry: { gte: now, lte: in30Days },
          },
        }),
        db.apiKey.count({ where: { status: 'active' } }),
      ])

    return NextResponse.json({
      totalClients,
      activeClients,
      totalLicenses,
      activeLicenses,
      expiringSoon,
      totalApiKeys,
    })
  } catch (err) {
    console.error('[GET /api/dashboard-stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
