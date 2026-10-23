'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, Globe, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Sub = {
  id: string
  firmName: string
  status: string
  currentPeriodEnd: string | null
  billingInterval: 'MONTH' | 'YEAR'
  autoRenew: boolean
  seatLimit: number | null
  siteSeatLimit: number | null
  extraSeats: number
  extraSiteSeats: number
  trialEndsAt: string | null
  projectLimit: number | null
  user: { id: string; name: string; email: string; status: string }
  plan: { id: string; name: string; tier: string | null; maxUsers: number; maxProjects: number; maxSiteUsers: number }
  payments: { createdAt: string; amount: number; paymentRef: string }[]
}
type WebPlan = { id: string; name: string; tier: string | null; isActive: boolean }
type Failed = { id: string; type: string; attempts: number; lastError: string | null; createdAt: string }
type Metrics = {
  mrr: number
  arr: number
  payingFirms: number
  trials: number
  trialsEndingSoon: number
  pastDue: number
  atRisk: number
  lapsed: number
  totalFirms: number
  newThisMonth: number
  revenueThisMonth: number
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-500',
}
const STATES: { key: string; label: string }[] = [
  { key: '', label: 'All firms' },
  { key: 'paying', label: 'Paying' },
  { key: 'trial', label: 'On trial' },
  { key: 'renewal_off', label: 'Auto-renew off' },
  { key: 'past_due', label: 'Payment due' },
  { key: 'lapsed', label: 'Term ended' },
  { key: 'suspended', label: 'Suspended / cancelled' },
]
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const limit = (n: number) => (n >= 100_000 ? '∞' : String(n))
const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white'

function Kpi({ label, value, sub, tone = 'gray', onClick }: { label: string; value: string | number; sub?: string; tone?: string; onClick?: () => void }) {
  const tones: Record<string, string> = { gray: 'text-gray-900', green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', indigo: 'text-indigo-600' }
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`text-left bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 ${onClick ? 'hover:border-indigo-200 cursor-pointer' : 'cursor-default'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </button>
  )
}

function GrantForm({ plans, onDone, onClose }: { plans: WebPlan[]; onDone: (text: string) => void; onClose: () => void }) {
  const [f, setF] = useState({ email: '', planId: plans.find((p) => p.isActive)?.id ?? '', months: '12', firmName: '', seatLimit: '', siteSeatLimit: '', projectLimit: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/web-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, months: Number(f.months) }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error ?? 'Could not grant')
    onDone(`Granted to ${f.email}.`)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Grant a subscription</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">For sales-led, Enterprise or complimentary deals. No payment is recorded and nothing renews automatically.</p>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-gray-700">Owner&apos;s account email</span>
          <input required type="email" className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="They must have an arcpem.com account" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-gray-700">Plan</span>
            <select className={field} value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (retired)'}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-gray-700">Months</span>
            <input required type="number" min={1} max={60} className={field} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-gray-700">Firm name <span className="text-gray-400 font-normal">(optional)</span></span>
          <input className={field} value={f.firmName} onChange={(e) => setF({ ...f, firmName: e.target.value })} placeholder="Defaults to their billing name" />
        </label>
        <div>
          <span className="text-sm font-medium text-gray-700">Custom limits <span className="text-gray-400 font-normal">(empty = plan default)</span></span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            <input type="number" min={1} className={field} placeholder="Team seats" value={f.seatLimit} onChange={(e) => setF({ ...f, seatLimit: e.target.value })} />
            <input type="number" min={1} className={field} placeholder="Site seats" value={f.siteSeatLimit} onChange={(e) => setF({ ...f, siteSeatLimit: e.target.value })} />
            <input type="number" min={1} className={field} placeholder="Projects" value={f.projectLimit} onChange={(e) => setF({ ...f, projectLimit: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Grant</Button>
        </div>
      </form>
    </div>
  )
}

/** ARC PEM firms: revenue at a glance, filters, export, and a way into each firm's full page. */
export default function WebSubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [plans, setPlans] = useState<WebPlan[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [outbox, setOutbox] = useState<{ pending: number; failed: Failed[] }>({ pending: 0, failed: [] })
  const [filters, setFilters] = useState({ search: '', state: '', plan: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [granting, setGranting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const query = new URLSearchParams({ search: filters.search, state: filters.state, plan: filters.plan }).toString()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/web-subscriptions?${query}&page=${page}`)
      const data = await res.json()
      setSubs(data.subscriptions ?? [])
      setPlans(data.plans ?? [])
      setOutbox(data.outbox ?? { pending: 0, failed: [] })
      setMetrics(data.metrics ?? null)
      setTotal(data.total ?? 0)
      setPageSize(data.pageSize ?? 50)
    } finally {
      setLoading(false)
    }
  }, [query, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const setFilter = (k: keyof typeof filters, v: string) => {
    setPage(1)
    setFilters((f) => ({ ...f, [k]: v }))
  }

  async function retryFailed() {
    setBusy(true)
    const res = await fetch('/api/web-subscriptions/outbox', { method: 'POST' })
    const data = await res.json()
    setMessage(res.ok ? { ok: true, text: `Re-queued ${data.requeued}; delivered ${data.delivered}.` } : { ok: false, text: data.error })
    setBusy(false)
    await load()
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      {metrics && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
          <Kpi label="MRR" value={inr(metrics.mrr)} sub={`ARR ${inr(metrics.arr)}`} tone="indigo" />
          <Kpi label="Paying firms" value={metrics.payingFirms} sub={`${metrics.totalFirms} firms in total`} tone="green" onClick={() => setFilter('state', 'paying')} />
          <Kpi label="On trial" value={metrics.trials} sub={`${metrics.trialsEndingSoon} end within 3 days`} onClick={() => setFilter('state', 'trial')} />
          <Kpi label="Payment due" value={metrics.pastDue} tone={metrics.pastDue ? 'amber' : 'gray'} onClick={() => setFilter('state', 'past_due')} />
          <Kpi label="At risk" value={metrics.atRisk} sub="Auto-renew off, ends in 30 days" tone={metrics.atRisk ? 'amber' : 'gray'} onClick={() => setFilter('state', 'renewal_off')} />
          <Kpi label="Lapsed" value={metrics.lapsed} sub="Paid before, term ended" tone={metrics.lapsed ? 'red' : 'gray'} onClick={() => setFilter('state', 'lapsed')} />
          <Kpi label="New this month" value={metrics.newThisMonth} />
          <Kpi label="Revenue this month" value={inr(metrics.revenueThisMonth)} sub="Before GST" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Globe size={16} />
          </div>
          <div className="flex-1 min-w-48">
            <h2 className="font-bold text-gray-900">Firms</h2>
            <p className="text-xs text-gray-400 mt-0.5">ARC PEM subscriptions. Open a firm to change its plan, limits, term or renewal.</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Firm, owner, email, sub_…"
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" value={filters.state} onChange={(e) => setFilter('state', e.target.value)}>
            {STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" value={filters.plan} onChange={(e) => setFilter('plan', e.target.value)}>
            <option value="">All plans</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (retired)'}</option>)}
          </select>
          <a href={`/api/web-subscriptions/export?${query}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
            <Download size={14} /> CSV
          </a>
          <Button variant="primary" size="sm" onClick={() => setGranting(true)}>
            <Plus size={14} /> Grant
          </Button>
        </div>

        {(outbox.pending > 0 || outbox.failed.length > 0) && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center gap-3 text-sm text-amber-800">
            <AlertTriangle size={15} />
            <span className="flex-1">
              {outbox.pending} update{outbox.pending === 1 ? '' : 's'} waiting to reach the app
              {outbox.failed.length > 0 && `, ${outbox.failed.length} failed (last: ${outbox.failed[0].lastError ?? 'unknown error'})`}.
            </span>
            {outbox.failed.length > 0 && (
              <Button variant="secondary" size="sm" loading={busy} onClick={retryFailed}>
                <RefreshCw size={13} /> Retry failed
              </Button>
            )}
          </div>
        )}

        {message && (
          <div className={`px-6 py-3 text-sm border-b ${message.ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{message.text}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Firm / owner</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Term ends</th>
                <th className="px-4 py-3">Seats · site · projects</th>
                <th className="px-4 py-3">Last payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && subs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No firms match.</td></tr>
              ) : (
                subs.map((s) => {
                  const lapsed = s.currentPeriodEnd && new Date(s.currentPeriodEnd) < new Date()
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <Link href={`/admin/web-subscriptions/${s.id}`} className="font-semibold text-indigo-700 hover:underline">{s.firmName}</Link>
                        <p className="text-xs text-gray-400">{s.user.name} · {s.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{s.plan.name.replace(/^web\s+/i, '')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] ?? ''}`}>{s.status}</span>
                        {lapsed && <p className="text-[11px] text-red-600 mt-1">Term ended</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="text-gray-700">{s.billingInterval === 'MONTH' ? 'Monthly' : 'Annual'}</div>
                        <div className={s.autoRenew ? 'text-green-700' : 'text-gray-400'}>{s.autoRenew ? 'Auto-renew on' : 'Auto-renew off'}</div>
                        {s.trialEndsAt && <div className="text-amber-600">Trial until {day(s.trialEndsAt)}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{day(s.currentPeriodEnd)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {limit(s.seatLimit ?? s.plan.maxUsers)} · {limit(s.siteSeatLimit ?? s.plan.maxSiteUsers ?? 0)} · {limit(s.projectLimit ?? s.plan.maxProjects)}
                        {(s.extraSeats || s.extraSiteSeats) ? <div className="text-gray-400">+{s.extraSeats} / +{s.extraSiteSeats} add-on</div> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {s.payments[0] ? <>{inr(s.payments[0].amount)} · {day(s.payments[0].createdAt)}</> : s.trialEndsAt ? 'Trial' : 'Granted'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{total} firms · page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {granting && (
        <GrantForm
          plans={plans}
          onClose={() => setGranting(false)}
          onDone={(text) => {
            setGranting(false)
            setMessage({ ok: true, text })
            load()
          }}
        />
      )}
    </div>
  )
}
