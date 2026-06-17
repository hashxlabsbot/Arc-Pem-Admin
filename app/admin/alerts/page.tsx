'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, ShieldOff, RefreshCw, CheckCircle2 } from 'lucide-react'

interface AlertLicense {
  id: string
  machineId: string
  expiry: string
  status: string
  fileName: string
  client: { name: string; email: string }
}

interface AlertData {
  expired: AlertLicense[]
  critical: AlertLicense[]
  warning: AlertLicense[]
  total: number
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const exp = new Date(dateStr)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExtend, setShowExtend] = useState<AlertLicense | null>(null)
  const [extendExpiry, setExtendExpiry] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/alerts')
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  async function handleRevoke(id: string) {
    await fetch(`/api/licenses/${id}/revoke`, { method: 'PATCH' })
    fetchAlerts()
  }

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault()
    if (!showExtend) return
    setSubmitting(true)
    try {
      await fetch(`/api/licenses/${showExtend.id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry: extendExpiry }),
      })
      setShowExtend(null)
      setExtendExpiry('')
      fetchAlerts()
    } catch {}
    setSubmitting(false)
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Loading alerts...</div>

  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-end">
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-2xl p-5 flex items-center gap-4 border ${data.expired.length > 0 ? 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200/60' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${data.expired.length > 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <ShieldOff size={20} />
            </div>
            <div>
              <p className="text-[28px] font-black tabular-nums leading-none text-gray-900">{data.expired.length}</p>
              <p className="text-sm font-semibold text-gray-600 mt-1">Expired</p>
              <p className={`text-xs font-medium mt-0.5 ${data.expired.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {data.expired.length > 0 ? 'Requires immediate action' : 'No expired licenses'}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl p-5 flex items-center gap-4 border ${data.critical.length > 0 ? 'bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200/60' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${data.critical.length > 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[28px] font-black tabular-nums leading-none text-gray-900">{data.critical.length}</p>
              <p className="text-sm font-semibold text-gray-600 mt-1">Critical</p>
              <p className={`text-xs font-medium mt-0.5 ${data.critical.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {data.critical.length > 0 ? 'Expiring within 7 days' : 'None critical'}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl p-5 flex items-center gap-4 border ${data.warning.length > 0 ? 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200/60' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${data.warning.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-[28px] font-black tabular-nums leading-none text-gray-900">{data.warning.length}</p>
              <p className="text-sm font-semibold text-gray-600 mt-1">Warning</p>
              <p className={`text-xs font-medium mt-0.5 ${data.warning.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {data.warning.length > 0 ? 'Expiring within 30 days' : 'None in warning range'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All clear */}
      {data && data.total === 0 && (
        <div className="bg-white rounded-2xl border border-emerald-200/60 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <p className="text-gray-800 font-bold text-lg">All clear!</p>
          <p className="text-sm text-gray-400 mt-1">No license alerts at this time.</p>
        </div>
      )}

      {/* Alert Sections */}
      {data && data.expired.length > 0 && (
        <AlertSection
          title="Expired Licenses"
          subtitle="These active licenses have already expired"
          accent="bg-gradient-to-r from-red-500 to-rose-600"
          headerBg="bg-red-50 border-red-100"
          titleColor="text-red-700"
          licenses={data.expired}
          onRevoke={handleRevoke}
          onExtend={(l) => { setShowExtend(l); setExtendExpiry('') }}
        />
      )}

      {data && data.critical.length > 0 && (
        <AlertSection
          title="Critical — Expiring Within 7 Days"
          subtitle="These licenses are expiring very soon"
          accent="bg-gradient-to-r from-orange-500 to-amber-500"
          headerBg="bg-orange-50 border-orange-100"
          titleColor="text-orange-700"
          licenses={data.critical}
          onRevoke={handleRevoke}
          onExtend={(l) => { setShowExtend(l); setExtendExpiry('') }}
        />
      )}

      {data && data.warning.length > 0 && (
        <AlertSection
          title="Warning — Expiring Within 30 Days"
          subtitle="These licenses will expire within 30 days"
          accent="bg-gradient-to-r from-amber-400 to-yellow-400"
          headerBg="bg-amber-50 border-amber-100"
          titleColor="text-amber-700"
          licenses={data.warning}
          onRevoke={handleRevoke}
          onExtend={(l) => { setShowExtend(l); setExtendExpiry('') }}
        />
      )}

      {/* Extend Modal */}
      {showExtend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Extend License</h2>
              <p className="text-sm text-gray-500 mt-0.5">{showExtend.client.name} — <span className="font-mono text-xs">{showExtend.machineId}</span></p>
            </div>
            <form onSubmit={handleExtend} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={extendExpiry}
                  onChange={(e) => setExtendExpiry(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowExtend(null)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {submitting ? 'Extending...' : 'Extend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertSection({
  title, subtitle, accent, headerBg, titleColor, licenses, onRevoke, onExtend,
}: {
  title: string; subtitle: string; accent: string; headerBg: string; titleColor: string
  licenses: AlertLicense[]
  onRevoke: (id: string) => void
  onExtend: (l: AlertLicense) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <div className={`px-6 py-4 border-b ${headerBg}`}>
        <h2 className={`font-bold text-sm ${titleColor}`}>{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Client</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Machine ID</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Expiry</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Days</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {licenses.map((lic) => {
              const days = daysUntil(lic.expiry)
              return (
                <tr key={lic.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-gray-900">{lic.client.name}</p>
                    <p className="text-xs text-gray-400">{lic.client.email}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-600 bg-slate-50/50">{lic.machineId}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs tabular-nums">{new Date(lic.expiry).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      days < 0
                        ? 'bg-red-50 text-red-700 border-red-100'
                        : days <= 7
                        ? 'bg-orange-50 text-orange-700 border-orange-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onExtend(lic)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      >
                        <CalendarDays size={13} />
                        Extend
                      </button>
                      <button
                        onClick={() => onRevoke(lic.id)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors font-medium"
                      >
                        <ShieldOff size={13} />
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
