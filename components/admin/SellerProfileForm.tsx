'use client'

import { useEffect, useState } from 'react'
import { Building2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface SellerForm {
  legalName: string
  gstin: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  stateCode: string
  pincode: string
  email: string
  phone: string
  hsnSac: string
  taxRate: string
  invoicePrefix: string
  bankDetails: string
}

const EMPTY: SellerForm = {
  legalName: '', gstin: '', addressLine1: '', addressLine2: '', city: '', state: '',
  stateCode: '', pincode: '', email: '', phone: '', hsnSac: '998314', taxRate: '18',
  invoicePrefix: 'ARC', bankDetails: '',
}

export function SellerProfileForm() {
  const [form, setForm] = useState<SellerForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/settings/seller')
      .then(r => r.json())
      .then(d => {
        if (d.seller) {
          setForm({
            legalName: d.seller.legalName ?? '',
            gstin: d.seller.gstin ?? '',
            addressLine1: d.seller.addressLine1 ?? '',
            addressLine2: d.seller.addressLine2 ?? '',
            city: d.seller.city ?? '',
            state: d.seller.state ?? '',
            stateCode: d.seller.stateCode ?? '',
            pincode: d.seller.pincode ?? '',
            email: d.seller.email ?? '',
            phone: d.seller.phone ?? '',
            hsnSac: d.seller.hsnSac ?? '998314',
            taxRate: String(d.seller.taxRate ?? 18),
            invoicePrefix: d.seller.invoicePrefix ?? 'ARC',
            bankDetails: d.seller.bankDetails ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof SellerForm>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/seller', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setMsg({ text: 'Seller details saved.', ok: true })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Failed to save', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
      <div className="p-6">
        <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <Building2 size={15} />
          </div>
          Seller / GST Details
        </h2>
        <p className="text-xs text-gray-400 mb-5 ml-11">Used on every GST tax invoice generated for subscriptions.</p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Legal / Company Name" value={form.legalName} onChange={e => set('legalName', e.target.value)} />
              <Input label="GSTIN" value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} hint="15-character GSTIN" />
              <Input label="Address Line 1" value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} />
              <Input label="Address Line 2" value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} />
              <Input label="City" value={form.city} onChange={e => set('city', e.target.value)} />
              <Input label="State" value={form.state} onChange={e => set('state', e.target.value)} />
              <Input label="State Code" value={form.stateCode} onChange={e => set('stateCode', e.target.value)} hint="2-digit GST code, e.g. 27" />
              <Input label="Pincode" value={form.pincode} onChange={e => set('pincode', e.target.value)} />
              <Input label="Email" value={form.email} onChange={e => set('email', e.target.value)} />
              <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
              <Input label="HSN / SAC" value={form.hsnSac} onChange={e => set('hsnSac', e.target.value)} hint="SaaS default 998314" />
              <Input label="Tax Rate (%)" type="number" value={form.taxRate} onChange={e => set('taxRate', e.target.value)} />
              <Input label="Invoice Prefix" value={form.invoicePrefix} onChange={e => set('invoicePrefix', e.target.value)} hint="e.g. ARC → ARC/2026-27/0001" />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">Bank / Payment Details</label>
              <textarea
                value={form.bankDetails}
                onChange={e => set('bankDetails', e.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Account name, A/C no., IFSC, UPI… (optional, shown on invoice)"
              />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button onClick={save} loading={saving}>
                <Save size={15} /> Save details
              </Button>
              {msg && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  {msg.text}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
