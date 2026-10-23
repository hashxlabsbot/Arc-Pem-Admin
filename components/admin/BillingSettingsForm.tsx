'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, IndianRupee, Save } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type Rules = {
  seatAddonMonthly: number
  siteSeatAddonMonthly: number
  annualBilledMonths: number
  trialDays: number
  maxAddonSeats: number
}
type Form = Record<keyof Rules, string>

/** Billing rules for ARC PEM subscriptions: add-on seat prices, the free trial and the annual discount. */
export function BillingSettingsForm() {
  const [form, setForm] = useState<Form | null>(null)
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null }>({ updatedAt: null, updatedBy: null })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/billing-settings')
      .then((r) => r.json())
      .then((d) => {
        if (!d.rules) return
        setForm(Object.fromEntries(Object.entries(d.rules).map(([k, v]) => [k, String(v)])) as Form)
        setMeta({ updatedAt: d.updatedAt, updatedBy: d.updatedBy })
      })
      .catch(() => setMsg({ text: 'Could not load billing settings.', ok: false }))
  }, [])

  const set = (key: keyof Rules, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f))

  async function save() {
    if (!form) return
    if (!confirm('Apply these billing settings? New checkouts use them within a minute; running subscriptions keep their current price.')) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/billing-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]))),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setMeta({ updatedAt: data.updatedAt, updatedBy: 'you' })
      setMsg({ text: 'Billing settings saved. The website updates within a minute.', ok: true })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Failed to save', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const months = Number(form?.annualBilledMonths ?? 12)
  const free = 12 - months

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
      <div className="p-6">
        <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <IndianRupee size={15} />
          </div>
          Subscription billing
        </h2>
        <p className="text-xs text-gray-400 mb-5 ml-11">
          Add-on seats, free trial and annual discount for ARC PEM. Plan prices and limits are edited under{' '}
          <a href="/admin/subscriptions" className="text-indigo-600 underline">Plans</a>.
        </p>

        {!form ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Team seat add-on (₹/month)" type="number" min={0} value={form.seatAddonMonthly}
                onChange={(e) => set('seatAddonMonthly', e.target.value)} hint="Owner, partners, accounts, office" />
              <Input label="Site seat add-on (₹/month)" type="number" min={0} value={form.siteSeatAddonMonthly}
                onChange={(e) => set('siteSeatAddonMonthly', e.target.value)} hint="Site engineers and supervisors" />
              <Input label="Most add-on seats" type="number" min={0} value={form.maxAddonSeats}
                onChange={(e) => set('maxAddonSeats', e.target.value)} hint="Of each kind, per firm, self-serve" />
              <Input label="Free trial (days)" type="number" min={0} max={60} value={form.trialDays}
                onChange={(e) => set('trialDays', e.target.value)} hint="0 turns the free trial off" />
              <Input label="Annual billing (months charged)" type="number" min={6} max={12} value={form.annualBilledMonths}
                onChange={(e) => set('annualBilledMonths', e.target.value)}
                hint={free > 0 ? `${free} month${free === 1 ? '' : 's'} free (${Math.round((free / 12) * 100)}% off)` : 'No annual discount'} />
            </div>
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              New prices apply to new checkouts and to firms that change plan or seats. Running subscriptions keep the
              price they were sold at, as Razorpay fixes it per subscription.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={save} loading={saving}>
                <Save size={15} /> Save billing settings
              </Button>
              {msg && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  {msg.text}
                </span>
              )}
              {meta.updatedAt && meta.updatedBy && !msg && (
                <span className="text-xs text-gray-400">
                  Last changed {new Date(meta.updatedAt).toLocaleString('en-IN')}{` by ${meta.updatedBy}`}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
