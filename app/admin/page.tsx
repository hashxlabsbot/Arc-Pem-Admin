import { db } from '@/lib/db'
import { DashboardCharts } from '@/components/admin/DashboardCharts'
import {
  Users, Building2, ShieldCheck, TrendingUp,
  UserCheck, UserPlus, AlertTriangle, Key,
} from 'lucide-react'

// Live, admin-only dashboard data — render per request, never prerender.
export const dynamic = 'force-dynamic'

async function getStats() {
  const now          = new Date()
  const in30Days     = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const [
    totalUsers, activeUsers, newThisMonth, newLastMonth, usersWithPlan,
    totalClients, activeClients,
    totalLicenses, activeLicenses, revokedLicenses, expiringSoon,
    totalApiKeys,
    stdClients, proClients, entClients,
    recentActivity, recentClients,
  ] = await Promise.all([
    db.user.count({ where: { role: 'USER' } }),
    db.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
    db.user.count({ where: { role: 'USER', createdAt: { gte: startOfMonth } } }),
    db.user.count({ where: { role: 'USER', createdAt: { gte: startOfLast, lte: endOfLast } } }),
    db.user.count({ where: { role: 'USER', planId: { not: null } } }),
    db.client.count(),
    db.client.count({ where: { status: 'active' } }),
    db.license.count(),
    db.license.count({ where: { status: 'active' } }),
    db.license.count({ where: { status: 'revoked' } }),
    db.license.count({ where: { status: 'active', expiry: { gte: now, lte: in30Days } } }),
    db.apiKey.count({ where: { status: 'active' } }),
    db.client.count({ where: { plan: 'standard' } }),
    db.client.count({ where: { plan: 'professional' } }),
    db.client.count({ where: { plan: 'enterprise' } }),
    db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    db.client.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
  ])

  const expiredLicenses = Math.max(totalLicenses - activeLicenses - revokedLicenses, 0)
  const conversionRate  = totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0
  const newUsersDiff    = newLastMonth === 0
    ? (newThisMonth > 0 ? 100 : 0)
    : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)

  const monthlyData: { month: string; users: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const count = await db.user.count({ where: { role: 'USER', createdAt: { gte: start, lte: end } } })
    monthlyData.push({ month: d.toLocaleString('default', { month: 'short' }), users: count })
  }

  const licenseStatusData = [
    { name: 'Active',  value: activeLicenses,  color: '#10b981' },
    { name: 'Expired', value: expiredLicenses,  color: '#f59e0b' },
    { name: 'Revoked', value: revokedLicenses,  color: '#ef4444' },
  ].filter(d => d.value > 0)

  const clientsByPlan = [
    { plan: 'Standard',     count: stdClients,  color: '#6366f1' },
    { plan: 'Professional', count: proClients,  color: '#3b82f6' },
    { plan: 'Enterprise',   count: entClients,  color: '#8b5cf6' },
  ]

  return {
    totalUsers, activeUsers, newThisMonth, newUsersDiff, conversionRate,
    totalClients, activeClients,
    totalLicenses, activeLicenses, expiringSoon, totalApiKeys,
    monthlyData, licenseStatusData, clientsByPlan,
    recentActivity: recentActivity.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
    recentClients:  recentClients.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
  }
}

/* ── KPI card ──────────────────────────────────────────────── */
function KpiCard({
  title, value, sub, trend, icon, gradient, border, iconBg, accent,
}: {
  title: string; value: string | number; sub: string
  trend?: number; icon: React.ReactNode
  gradient: string; border: string; iconBg: string; accent: string
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[32px] font-black text-gray-900 tabular-nums leading-none">{value}</p>
        <p className="text-sm font-semibold text-gray-600 mt-1.5">{title}</p>
        <p className={`text-xs font-medium mt-1 ${accent}`}>{sub}</p>
      </div>
    </div>
  )
}

/* ── Secondary info pill ───────────────────────────────────── */
function InfoPill({
  icon, label, value, warn,
}: { icon: React.ReactNode; label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-4 bg-white rounded-2xl border px-5 py-4 shadow-sm ${warn ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${warn ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const s = await getStats()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateStr  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* ── Greeting ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{greeting} 👋</h2>
          <p className="text-sm text-gray-400 mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          All systems online
        </div>
      </div>

      {/* ── Primary KPI cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Users" value={s.totalUsers}
          sub={`+${s.newThisMonth} joined this month`}
          trend={s.newUsersDiff}
          icon={<Users size={20}/>}
          gradient="from-blue-50 via-sky-50 to-indigo-100"
          border="border-blue-200/60" iconBg="bg-blue-600" accent="text-blue-600"
        />
        <KpiCard
          title="Total Clients" value={s.totalClients}
          sub={`${s.activeClients} currently active`}
          icon={<Building2 size={20}/>}
          gradient="from-violet-50 to-purple-100"
          border="border-violet-200/60" iconBg="bg-violet-600" accent="text-violet-600"
        />
        <KpiCard
          title="Active Licenses" value={s.activeLicenses}
          sub={`of ${s.totalLicenses} total issued`}
          icon={<ShieldCheck size={20}/>}
          gradient="from-emerald-50 to-teal-100"
          border="border-emerald-200/60" iconBg="bg-emerald-600" accent="text-emerald-600"
        />
        <KpiCard
          title="Conversion Rate" value={`${s.conversionRate}%`}
          sub="subscribers on paid plan"
          icon={<TrendingUp size={20}/>}
          gradient="from-amber-50 to-orange-100"
          border="border-amber-200/60" iconBg="bg-amber-500" accent="text-amber-600"
        />
      </div>

      {/* ── Secondary info row ─────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <InfoPill icon={<UserCheck size={18}/>}  label="Active users"    value={s.activeUsers}   />
        <InfoPill icon={<UserPlus size={18}/>}   label="New this month"  value={s.newThisMonth}  />
        <InfoPill icon={<AlertTriangle size={18}/>} label="Expiring ≤30d" value={s.expiringSoon} warn={s.expiringSoon > 0} />
        <InfoPill icon={<Key size={18}/>}        label="Active API keys" value={s.totalApiKeys}  />
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <DashboardCharts
        monthlyData={s.monthlyData}
        licenseStatusData={s.licenseStatusData}
        clientsByPlan={s.clientsByPlan}
        recentActivity={s.recentActivity}
        recentClients={s.recentClients}
        newThisMonth={s.newThisMonth}
        newUsersDiff={s.newUsersDiff}
        conversionRate={s.conversionRate}
        totalApiKeys={s.totalApiKeys}
      />
    </div>
  )
}
