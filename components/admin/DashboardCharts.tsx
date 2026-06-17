'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, BarChart, Bar,
} from 'recharts'

interface MonthlyPoint  { month: string; users: number }
interface PiePoint      { name: string; value: number; color: string }
interface PlanPoint     { plan: string; count: number; color: string }
interface ActivityEntry { id: string; action: string; entityType?: string | null; details?: string | null; createdAt: string }
interface ClientEntry   { id: string; name: string; company?: string | null; plan: string; paymentStatus: string; createdAt: string }

interface Props {
  monthlyData: MonthlyPoint[]
  licenseStatusData: PiePoint[]
  clientsByPlan: PlanPoint[]
  recentActivity: ActivityEntry[]
  recentClients: ClientEntry[]
  newThisMonth: number
  newUsersDiff: number
  conversionRate: number
  totalApiKeys: number
}

/* ── Action badge colors ──────────────────────────────────── */
const ACTION_MAP: Record<string, [string, string]> = {
  CREATE:   ['bg-emerald-100 text-emerald-700', '#10b981'],
  DELETE:   ['bg-red-100 text-red-700',         '#ef4444'],
  REVOKE:   ['bg-orange-100 text-orange-700',   '#f97316'],
  GENERATE: ['bg-blue-100 text-blue-700',       '#3b82f6'],
  EXTEND:   ['bg-violet-100 text-violet-700',   '#8b5cf6'],
  UPDATE:   ['bg-slate-100 text-slate-600',     '#64748b'],
}
function actionStyle(action: string): [string, string] {
  const key = Object.keys(ACTION_MAP).find(k => action.startsWith(k))
  return key ? ACTION_MAP[key] : ['bg-gray-100 text-gray-600', '#9ca3af']
}

const PLAN_BADGE: Record<string, string> = {
  standard:     'bg-indigo-50 text-indigo-700 border-indigo-100',
  professional: 'bg-blue-50 text-blue-700 border-blue-100',
  enterprise:   'bg-purple-50 text-purple-700 border-purple-100',
}
const PAY_BADGE: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-red-50 text-red-700 border-red-100',
}

const AVATAR_BG = [
  'bg-blue-500', 'bg-violet-500', 'bg-teal-500',
  'bg-rose-500',  'bg-amber-500',  'bg-indigo-500',
]

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const TIP_STYLE: React.CSSProperties = {
  background: '#1e293b',
  border: 'none',
  borderRadius: 10,
  fontSize: 12,
  color: '#e2e8f0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
}
const TIP_LABEL: React.CSSProperties = { color: '#94a3b8', fontWeight: 500, marginBottom: 4 }

export function DashboardCharts({
  monthlyData, licenseStatusData, clientsByPlan, recentActivity, recentClients,
  newThisMonth, newUsersDiff, conversionRate,
}: Props) {
  return (
    <div className="space-y-5">

      {/* ── Row 1: Area chart (2/3) + right sidebar (1/3) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Area chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Color top bar */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"/>
          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Monthly Signups</h3>
                <p className="text-xs text-gray-400 mt-0.5">New user registrations — last 6 months</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-indigo-600 tabular-nums">+{newThisMonth}</p>
                <p className="text-xs text-gray-400">this month</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.22}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={TIP_STYLE} labelStyle={TIP_LABEL}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}/>
                <Area type="monotone" dataKey="users" name="Signups" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#areaGrad)"
                  dot={{ r: 4, fill: '#fff', stroke: '#6366f1', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Footer mini stats */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-slate-50/60">
            {[
              { label: 'vs last month', value: `${newUsersDiff >= 0 ? '+' : ''}${newUsersDiff}%`, color: newUsersDiff >= 0 ? 'text-emerald-600' : 'text-red-500' },
              { label: 'New this month', value: newThisMonth, color: 'text-blue-600' },
              { label: 'Conversion',     value: `${conversionRate}%`,  color: 'text-violet-600' },
            ].map((m, i) => (
              <div key={i} className="px-5 py-3">
                <p className={`text-lg font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar: License status donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500"/>
          <div className="p-5 flex-1">
            <h3 className="font-bold text-gray-900 text-sm">License Status</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">Distribution by state</p>

            {licenseStatusData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">No licenses yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={155}>
                  <PieChart>
                    <Pie
                      data={licenseStatusData.map(d => ({ ...d, fill: d.color }))}
                      cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                      dataKey="value" paddingAngle={3} strokeWidth={0}
                    />
                    <Tooltip contentStyle={TIP_STYLE} labelStyle={TIP_LABEL}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2.5 mt-2">
                  {licenseStatusData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}60` }}/>
                        <span className="text-sm text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-bold text-gray-900 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Bar (1/3) + Activity timeline (2/3) ──────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Clients by Plan bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600"/>
          <div className="p-5">
            <h3 className="font-bold text-gray-900 text-sm">Clients by Plan</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Tier distribution</p>
            <ResponsiveContainer width="100%" height={155}>
              <BarChart data={clientsByPlan.map(d => ({ ...d, fill: d.color }))} layout="vertical"
                margin={{ top: 0, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis type="category" dataKey="plan" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={76}/>
                <Tooltip contentStyle={TIP_STYLE} labelStyle={TIP_LABEL}/>
                <Bar dataKey="count" name="Clients" radius={[0, 6, 6, 0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500"/>
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Recent Activity</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest admin events across all modules</p>
          </div>
          <div className="flex-1 px-5 py-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No activity recorded.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => {
                  const [badgeClass] = actionStyle(a.action)
                  return (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${badgeClass}`}>
                        {a.action.replace(/_/g, ' ')}
                      </span>
                      <p className="flex-1 text-xs text-gray-600 leading-relaxed truncate">{a.details ?? a.entityType ?? '—'}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 pt-0.5">{timeAgo(a.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Clients horizontal strip ───────────── */}
      {recentClients.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"/>
          <div className="p-5 border-b border-gray-50">
            <h3 className="font-bold text-gray-900 text-sm">Recent Clients</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest registered clients</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {recentClients.map((c, i) => {
              const plan = PLAN_BADGE[c.plan]           ?? 'bg-gray-100 text-gray-600 border-gray-200'
              const pay  = PAY_BADGE[c.paymentStatus]   ?? 'bg-gray-100 text-gray-600 border-gray-200'
              return (
                <div key={c.id} className="flex flex-col items-center text-center p-3 rounded-xl bg-slate-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all gap-2.5">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md ${AVATAR_BG[i % AVATAR_BG.length]}`}>
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{c.company ?? '—'}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${plan}`}>{c.plan}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${pay}`}>{c.paymentStatus}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
