import { db } from '@/lib/db'
import { Users, UserPlus, TrendingUp } from 'lucide-react'

// Live, admin-only dashboard data — render per request, never prerender.
export const dynamic = 'force-dynamic'

async function getAnalytics() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalUsers, activeUsers, newThisMonth, usersWithPlan, planDistribution] =
    await Promise.all([
      db.user.count({ where: { role: 'USER' } }),
      db.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
      db.user.count({ where: { role: 'USER', createdAt: { gte: startOfMonth } } }),
      db.user.count({ where: { role: 'USER', planId: { not: null } } }),
      db.plan.findMany({ include: { _count: { select: { users: true } } } }),
    ])

  const conversionRate = totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0

  const monthlyData: { month: string; count: number; fullMonth: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const count = await db.user.count({ where: { role: 'USER', createdAt: { gte: start, lte: end } } })
    monthlyData.push({
      month: d.toLocaleString('default', { month: 'short' }),
      fullMonth: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
      count,
    })
  }

  return {
    totalUsers, activeUsers, newThisMonth, conversionRate, monthlyData,
    planDist: planDistribution.map((p) => ({ name: p.name, count: p._count.users })),
  }
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  const maxCount = Math.max(...data.monthlyData.map((m) => m.count), 1)

  const totalPlanUsers = data.planDist.reduce((sum, p) => sum + p.count, 0)
  const donutColors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  let cumulativePercent = 0
  const donutSegments = data.planDist.map((p, i) => {
    const percent = totalPlanUsers > 0 ? (p.count / totalPlanUsers) * 100 : 0
    const start = cumulativePercent
    cumulativePercent += percent
    return { ...p, percent, start, color: donutColors[i % donutColors.length] }
  })

  const gradientParts = donutSegments.map((s) => `${s.color} ${s.start}% ${s.start + s.percent}%`)

  return (
    <div className="space-y-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 border border-blue-200/60 rounded-2xl p-5 flex flex-col gap-4">
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[32px] font-black text-gray-900 tabular-nums leading-none">{data.activeUsers}</p>
            <p className="text-sm font-semibold text-gray-600 mt-1.5">Active Users</p>
            <p className="text-xs font-medium mt-1 text-blue-600">of {data.totalUsers} total registered</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200/60 rounded-2xl p-5 flex flex-col gap-4">
          <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <UserPlus size={20} />
          </div>
          <div>
            <p className="text-[32px] font-black text-gray-900 tabular-nums leading-none">{data.newThisMonth}</p>
            <p className="text-sm font-semibold text-gray-600 mt-1.5">New This Month</p>
            <p className="text-xs font-medium mt-1 text-emerald-600">registrations this month</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200/60 rounded-2xl p-5 flex flex-col gap-4">
          <div className="w-11 h-11 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[32px] font-black text-gray-900 tabular-nums leading-none">{data.conversionRate}%</p>
            <p className="text-sm font-semibold text-gray-600 mt-1.5">Conversion Rate</p>
            <p className="text-xs font-medium mt-1 text-violet-600">subscribers on paid plan</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Monthly Bar Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />
          <div className="p-6">
            <h3 className="font-bold text-gray-900">Monthly User Growth</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-6">Registrations over the last 6 months</p>
            <div className="flex items-end gap-4" style={{ height: '160px' }}>
              {data.monthlyData.map((m) => {
                const heightPercent = (m.count / maxCount) * 100
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-xs font-bold text-gray-500">{m.count}</span>
                    <div className="w-full flex items-end" style={{ height: '110px' }}>
                      <div
                        title={`${m.fullMonth}: ${m.count} users`}
                        className="w-full bg-gradient-to-t from-indigo-600 to-blue-400 rounded-t-lg transition-all group-hover:from-indigo-700 group-hover:to-blue-500 cursor-default shadow-sm"
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{m.month}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Plan Distribution Donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
          <div className="p-5">
            <h3 className="font-bold text-gray-900 text-sm">Plan Distribution</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-5">Active subscriptions by plan</p>

            {totalPlanUsers === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="w-24 h-24 rounded-full border-8 border-gray-100 mb-4" />
                <p className="text-sm">No subscriptions yet</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center mb-5">
                  <div
                    className="w-32 h-32 rounded-full shadow-inner"
                    style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}
                  />
                </div>
                <div className="space-y-2.5">
                  {donutSegments.map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}60` }} />
                        <span className="text-sm text-gray-600">{s.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900 tabular-nums">{s.count}</span>
                        <span className="text-gray-400 ml-1 text-xs">({s.percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Growth Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500" />
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">Month-by-Month Breakdown</h3>
          <p className="text-xs text-gray-400 mt-0.5">Growth rate vs prior month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Signups</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Growth</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.monthlyData.map((m, idx) => {
                const prev = idx > 0 ? data.monthlyData[idx - 1].count : null
                const growth =
                  prev !== null
                    ? prev === 0 ? (m.count > 0 ? 100 : 0) : Math.round(((m.count - prev) / prev) * 100)
                    : null
                const barWidth = maxCount > 0 ? (m.count / maxCount) * 100 : 0
                return (
                  <tr key={m.month} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-700">{m.fullMonth}</td>
                    <td className="px-5 py-3 font-bold text-gray-900 tabular-nums">{m.count}</td>
                    <td className="px-5 py-3">
                      {growth !== null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                          growth >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {growth >= 0 ? '+' : ''}{growth}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 w-40">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full h-2 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
