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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Build date boundaries for last 6 months up-front
    const monthBoundaries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        label: d.toLocaleString('default', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      }
    })
    const sixMonthsAgo = monthBoundaries[0].start

    // Fetch all counts in one round-trip
    const [totalUsers, activeUsers, newThisMonth, usersWithPlan, planDist, recentUsers] =
      await Promise.all([
        db.user.count({ where: { role: 'USER' } }),
        db.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
        db.user.count({ where: { role: 'USER', createdAt: { gte: startOfMonth } } }),
        db.user.count({ where: { role: 'USER', planId: { not: null } } }),
        db.plan.findMany({ include: { _count: { select: { users: true } } } }),
        db.user.findMany({
          where: { role: 'USER', createdAt: { gte: sixMonthsAgo } },
          select: { createdAt: true },
        }),
      ])

    const conversionRate =
      totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0

    // Bucket recentUsers into months in memory — no extra DB queries
    const monthlyData = monthBoundaries.map(({ label, start, end }) => ({
      month: label,
      count: recentUsers.filter((u) => u.createdAt >= start && u.createdAt <= end).length,
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
    console.error('[GET /api/analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
