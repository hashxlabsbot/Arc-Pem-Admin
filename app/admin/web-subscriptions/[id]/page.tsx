'use client'

import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Payment = {
  id: string
  paymentRef: string
  amount: number
  periodStart: string
  periodEnd: string
  createdAt: string
  status: string | null
  invoiceId: string | null
  invoiceNumber: string | null
}
type Firm = {
  id: string
  firmName: string
  status: string
  currentPeriodEnd: string | null
  billingInterval: 'MONTH' | 'YEAR'
  autoRenew: boolean
  razorpaySubscriptionId: string | null
  seatLimit: number | null
  siteSeatLimit: number | null
  projectLimit: number | null
  extraSeats: number
  extraSiteSeats: number
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
  plan: { id: string; name: string; tier: string | null; price: number; maxUsers: number; maxSiteUsers: number; maxProjects: number }
  user: {
    id: string
    name: string
    email: string
    status: string
    createdAt: string
    billingProfile: { legalName: string; gstin: string | null; city: string; state: string; phone: string | null } | null
  }
  payments: Payment[]
}
type Activity = { id: string; action: string; details: string | null; createdAt: string }
type WebPlan = { id: string; name: string; isActive: boolean }

const STATUSES = ['ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELED']
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-500',
}
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const limit = (n: number) => (n >= 100_000 ? 'Unlimited' : String(n))
const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium text-right">{v}</span>
    </div>
  )
}

/** One ARC PEM firm: its subscription, limits, payments and history, with every control staff need. */
export default function FirmPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)
  const [firm, setFirm] = useState<Firm | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [plans, setPlans] = useState<WebPlan[]>([])
  const [canStop, setCanStop] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({ planId: '', status: '', months: '', days: '', seats: '', siteSeats: '', projects: '', firmName: '' })

  const load = useCallback(async () => {
    const [res, list] = await Promise.all([fetch(`/api/web-subscriptions/${params.id}`), fetch('/api/web-subscriptions?search=')])
    const data = await res.json()
    const all = await list.json()
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? 'Not found' })
    const f: Firm = data.subscription
    setFirm(f)
    setActivity(data.activity ?? [])
    setCanStop(Boolean(data.canStopRenewal))
    setPlans(all.plans ?? [])
    setForm({
      planId: f.plan.id,
      status: f.status,
      months: '',
      days: '',
      seats: f.seatLimit?.toString() ?? '',
      siteSeats: f.siteSeatLimit?.toString() ?? '',
      projects: f.projectLimit?.toString() ?? '',
      firmName: f.firmName,
    })
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function act(name: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(name)
    setMsg(null)
    try {
      const res = await fetch(`/api/web-subscriptions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setMsg(
        res.ok
          ? { ok: true, text: data.delivered ? 'Saved and synced to the app.' : 'Saved. The app will be updated when it can be reached.' }
          : { ok: false, text: data.error ?? 'Could not save' },
      )
      await load()
    } finally {
      setBusy('')
    }
  }

  if (!firm) return <div className="text-sm text-gray-400 p-6">{msg?.text ?? 'Loading…'}</div>

  const now = new Date()
  const end = firm.currentPeriodEnd ? new Date(firm.currentPeriodEnd) : null
  const lapsed = end ? end < now : false
  const seats = firm.seatLimit ?? firm.plan.maxUsers
  const siteSeats = firm.siteSeatLimit ?? firm.plan.maxSiteUsers
  const projects = firm.projectLimit ?? firm.plan.maxProjects
  const paid = firm.payments.reduce((sum, p) => sum + (p.status === 'refunded' ? 0 : p.amount), 0)

  return (
    <div className="space-y-5">
      <Link href="/admin/web-subscriptions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> All firms
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{firm.firmName}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[firm.status] ?? ''}`}>{firm.status}</span>
              {firm.trialEndsAt && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Trial</span>}
              {lapsed && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Term ended</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {firm.user.name} · <a className="underline" href={`mailto:${firm.user.email}`}>{firm.user.email}</a>
              {firm.user.billingProfile?.phone ? ` · ${firm.user.billingProfile.phone}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {firm.razorpaySubscriptionId && (
              <a
                href={`https://dashboard.razorpay.com/app/subscriptions/${firm.razorpaySubscriptionId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                Razorpay <ExternalLink size={13} />
              </a>
            )}
            <Button variant="secondary" size="sm" loading={busy === 'resync'} onClick={() => act('resync', { action: 'resync' })}>
              <RefreshCw size={13} /> Re-sync to app
            </Button>
          </div>
        </div>
        {msg && (
          <div className={`px-6 py-3 text-sm border-t ${msg.ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{msg.text}</div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Subscription">
          <Row k="Plan" v={firm.plan.name.replace(/^web\s+/i, '')} />
          <Row k="Billing" v={firm.billingInterval === 'MONTH' ? 'Monthly' : 'Annual'} />
          <Row k="Auto-renew" v={<span className={firm.autoRenew ? 'text-green-700' : 'text-gray-500'}>{firm.autoRenew ? 'On' : 'Off'}</span>} />
          <Row k={firm.trialEndsAt ? 'Trial ends' : lapsed ? 'Ended' : firm.autoRenew ? 'Renews' : 'Access until'} v={day(firm.currentPeriodEnd)} />
          <Row k="Customer since" v={day(firm.createdAt)} />
          <Row k="Paid to date" v={inr(Math.round(paid))} />
        </Card>
        <Card title="Limits">
          <Row k="Team seats" v={<>{limit(seats)}{firm.extraSeats ? <span className="text-gray-400"> (+{firm.extraSeats} add-on)</span> : firm.seatLimit ? <span className="text-gray-400"> (custom)</span> : null}</>} />
          <Row k="Site seats" v={<>{limit(siteSeats)}{firm.extraSiteSeats ? <span className="text-gray-400"> (+{firm.extraSiteSeats} add-on)</span> : firm.siteSeatLimit ? <span className="text-gray-400"> (custom)</span> : null}</>} />
          <Row k="Active projects" v={<>{limit(projects)}{firm.projectLimit ? <span className="text-gray-400"> (custom)</span> : null}</>} />
          <p className="text-xs text-gray-400 mt-2">Seat usage is shown to the firm in the app; it is not stored here.</p>
        </Card>
        <Card title="Billing details">
          <Row k="Legal name" v={firm.user.billingProfile?.legalName ?? '—'} />
          <Row k="GSTIN" v={firm.user.billingProfile?.gstin ?? '—'} />
          <Row k="Location" v={firm.user.billingProfile ? `${firm.user.billingProfile.city}, ${firm.user.billingProfile.state}` : '—'} />
          <Row k="Account status" v={firm.user.status} />
          <Row k="Razorpay subscription" v={<span className="font-mono text-xs">{firm.razorpaySubscriptionId ?? 'None (granted)'}</span>} />
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-4">Manage</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Plan</label>
            <select className={field} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (retired)'}</option>)}
            </select>
            <Button size="sm" variant="secondary" loading={busy === 'plan'} disabled={form.planId === firm.plan.id}
              onClick={() => act('plan', { action: 'plan', planId: form.planId }, 'Move this firm to the selected plan? Its price at Razorpay is not changed.')}>
              Change plan
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <Button size="sm" variant="secondary" loading={busy === 'status'} disabled={form.status === firm.status}
              onClick={() => act('status', { action: 'status', status: form.status }, `Set status to ${form.status}? SUSPENDED and CANCELED make the workspace read-only at once.`)}>
              Set status
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Extend access {firm.trialEndsAt ? '(trial)' : ''}</label>
            <div className="flex gap-2">
              <input className={field} type="number" min={0} placeholder="Months" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
              <input className={field} type="number" min={0} placeholder="Days" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            </div>
            <Button size="sm" variant="secondary" loading={busy === 'extend'} disabled={!Number(form.months) && !Number(form.days)}
              onClick={() => act('extend', { action: 'extend', months: Number(form.months) || 0, days: Number(form.days) || 0 }, 'Add this time free of charge?')}>
              Extend
            </Button>
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-2">
            <label className="text-sm font-medium text-gray-700">Custom limits <span className="text-gray-400 font-normal">(empty = plan default)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input className={field} type="number" min={1} placeholder={`Team seats (${limit(firm.plan.maxUsers)})`} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
              <input className={field} type="number" min={1} placeholder={`Site seats (${limit(firm.plan.maxSiteUsers)})`} value={form.siteSeats} onChange={(e) => setForm({ ...form, siteSeats: e.target.value })} />
              <input className={field} type="number" min={1} placeholder={`Projects (${limit(firm.plan.maxProjects)})`} value={form.projects} onChange={(e) => setForm({ ...form, projects: e.target.value })} />
            </div>
            <Button size="sm" variant="secondary" loading={busy === 'limits'}
              onClick={() => act('limits', { action: 'limits', seatLimit: form.seats || null, siteSeatLimit: form.siteSeats || null, projectLimit: form.projects || null })}>
              Save limits
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Firm name</label>
            <input className={field} value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} />
            <Button size="sm" variant="secondary" loading={busy === 'rename'} disabled={!form.firmName.trim() || form.firmName === firm.firmName}
              onClick={() => act('rename', { action: 'rename', firmName: form.firmName })}>
              Rename
            </Button>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <Button variant="danger" size="sm" loading={busy === 'stop'} disabled={!firm.autoRenew || (!!firm.razorpaySubscriptionId && !canStop)}
            onClick={() => act('stop', { action: 'stopRenewal' }, `Stop auto-renew for ${firm.firmName}? No further charges; access continues until ${day(firm.currentPeriodEnd)}.`)}>
            Stop auto-renew
          </Button>
          <span className="text-xs text-gray-500">
            {!firm.autoRenew
              ? 'Auto-renew is off.'
              : firm.razorpaySubscriptionId && !canStop
                ? 'Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to the admin app to stop renewals here, or cancel it in the Razorpay dashboard.'
                : 'Cancels the Razorpay subscription now; the firm keeps the time already paid for. Refunds are made in Razorpay and reverse the paid time automatically.'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-900">Payments</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Covers</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {firm.payments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No payments yet{firm.trialEndsAt ? ' — on free trial.' : ' — granted by staff.'}</td></tr>
              ) : (
                firm.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{day(p.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{inr(p.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{day(p.periodStart)} – {day(p.periodEnd)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.paymentRef}</td>
                    <td className="px-4 py-3 text-xs">{p.status ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.invoiceId ? (
                        <a href={`/api/invoices/${p.invoiceId}/download`} className="inline-flex items-center gap-1 text-indigo-600 text-xs font-medium">
                          <Download size={12} /> {p.invoiceNumber}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-4">History</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400">No staff changes yet.</p>
        ) : (
          <ol className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="text-gray-400 whitespace-nowrap w-40 shrink-0">{new Date(a.createdAt).toLocaleString('en-IN')}</span>
                <span className="text-gray-700"><b className="text-gray-900">{a.action}</b> · {a.details}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
