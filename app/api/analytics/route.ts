import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Authenticated, per-request endpoint — never statically prerender.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Build labels for the last 6 months (keyed by YYYY-MM for joining the
    // aggregated query result below).
    const monthBoundaries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('default', { month: 'short' }),
      }
    })
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // Aggregate signups per month in the database (GROUP BY) instead of pulling
    // every row into Node memory. Scales to millions of users.
    const monthlyRows = await db.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             COUNT(*) AS count
      FROM "User"
      WHERE "role" = 'USER' AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY 1
    `
    const monthlyMap = new Map(monthlyRows.map((r) => [r.month, Number(r.count)]))

    // Remaining aggregate counts in one round-trip.
    const [totalUsers, activeUsers, newThisMonth, usersWithPlan, planDist] =
      await Promise.all([
        db.user.count({ where: { role: 'USER' } }),
        db.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
        db.user.count({ where: { role: 'USER', createdAt: { gte: startOfMonth } } }),
        db.user.count({ where: { role: 'USER', planId: { not: null } } }),
        db.plan.findMany({ include: { _count: { select: { users: true } } } }),
      ])

    const conversionRate =
      totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0

    const monthlyData = monthBoundaries.map(({ key, label }) => ({
      month: label,
      count: monthlyMap.get(key) ?? 0,
    }))

    const planDistribution = planDist.map((p) => ({
      name: p.name,
      count: p._count.users,
    }))

    return NextResponse.json({
      totalUsers,
      activeUsers,
      newThisMonth,
      conversionRate,
      monthlyData,
      planDistribution,
    })
  } catch (err) {
    logger.error('GET /api/analytics failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
