'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Search, Download, ShieldOff, ShieldCheck, CalendarDays,
  Copy, Check, KeyRound, X, ShieldAlert, Clock, RefreshCw,
  LayoutList, Activity, AlertTriangle, Ban,
} from 'lucide-react'
import { usePaginatedList } from '@/lib/use-paginated-list'
import { Pagination } from '@/components/admin/Pagination'

interface Client { id: string; name: string; email: string }
interface License {
  id: string
  clientId: string
  client: { name: string; email: string }
  machineId: string
  seats: number
  issued: string
  expiry: string
  status: string
  licenseKey: string
  fileName: string
  notes?: string
  createdAt: string
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function StatusBadge({ expiry, status }: { expiry: string; status: string }) {
  if (status === 'revoked')
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><ShieldOff size={10}/>Revoked</span>
  const d = daysUntil(expiry)
  if (d < 0)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200"><Clock size={10}/>Expired</span>
  if (d <= 7)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><ShieldAlert size={10}/>Critical · {d}d</span>
  if (d <= 30)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><ShieldAlert size={10}/>Expiring · {d}d</span>
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Active · {d}d
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  function go() {
    navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000) })
  }
  return (
    <button onClick={go} title={ok ? 'Copied' : 'Copy license key'}
      className={`p-1.5 rounded-lg transition-all ${ok ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}>
      {ok ? <Check size={14}/> : <Copy size={14}/>}
    </button>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 transition-all'
const BTN_PRIMARY = 'flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50'
const BTN_GHOST   = 'flex items-center justify-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors'

function KpiCard({ label, value, gradient, border, iconBg, icon, accent }: {
  label: string; value: number; gradient: string; border: string; iconBg: string; icon: React.ReactNode; accent: string
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-2xl overflow-hidden shadow-sm`}>
      <div className={`h-1 ${accent}`} />
      <div className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{value}</p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function LicensesPage() {
  const [clients, setClients]           = useState<Client[]>([])
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showGen, setShowGen]           = useState(false)
  const [extendTarget, setExtendTarget] = useState<License | null>(null)
  const [viewKey, setViewKey]           = useState<License | null>(null)
  const [genForm, setGenForm]           = useState({ clientId: '', seats: 1, machineIds: [''], expiry: '', notes: '' })
  const [extendExpiry, setExtendExpiry] = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')

  function updateSeats(n: number) {
    const count = Math.max(1, Math.min(20, n))
    setGenForm(f => {
      const ids = [...f.machineIds]
      while (ids.length < count) ids.push('')
      return { ...f, seats: count, machineIds: ids.slice(0, count) }
    })
  }
  function updateMachineId(idx: number, val: string) {
    setGenForm(f => { const ids = [...f.machineIds]; ids[idx] = val; return { ...f, machineIds: ids } })
  }

  const {
    items: licenses,
    pagination,
    stats,
    loading,
    setPage,
    refresh: load,
  } = usePaginatedList<License>({
    url: '/api/licenses',
    itemsKey: 'licenses',
    search,
    filters: { status: statusFilter },
  })

  // Client list for the "Generate License" picker (capped page).
  useEffect(() => {
    fetch('/api/clients?pageSize=200')
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => {})
  }, [])

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError('')
    const emptyIdx = genForm.machineIds.findIndex(id => !id.trim())
    if (emptyIdx !== -1) { setError(`Machine ID ${emptyIdx + 1} is required.`); setSubmitting(false); return }
    const payload = { ...genForm, machineId: genForm.machineIds.map(id => id.trim()).join(' | ') }
    const res = await fetch('/api/licenses/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) { setError((await res.json()).error || 'Failed') } else {
      setShowGen(false); setGenForm({ clientId: '', seats: 1, machineIds: [''], expiry: '', notes: '' }); load()
    }
    setSubmitting(false)
  }
  async function revoke(id: string)   { await fetch(`/api/licenses/${id}/revoke`,   { method: 'PATCH' }); load() }
  async function unrevoke(id: string) { await fetch(`/api/licenses/${id}/unrevoke`, { method: 'PATCH' }); load() }
  async function extend(e: React.FormEvent) {
    e.preventDefault(); if (!extendTarget) return; setSubmitting(true)
    await fetch(`/api/licenses/${extendTarget.id}/extend`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry: extendExpiry }),
    })
    setExtendTarget(null); setExtendExpiry(''); setSubmitting(false); load()
  }
  async function download(id: string, fileName: string) {
    const blob = await (await fetch(`/api/licenses/${id}/download`)).blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click()
    URL.revokeObjectURL(a.href)
  }

  const total    = stats.total ?? 0
  const active   = stats.active ?? 0
  const expiring = stats.expiring ?? 0
  const inactive = stats.inactive ?? 0

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Licenses" value={total}
          gradient="from-slate-50 to-slate-100/60" border="border-slate-200"
          iconBg="bg-gradient-to-br from-slate-500 to-slate-700"
          accent="bg-gradient-to-r from-slate-400 to-slate-600"
          icon={<LayoutList size={18} className="text-white"/>} />
        <KpiCard label="Active" value={active}
          gradient="from-emerald-50 to-green-50/60" border="border-emerald-100"
          iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
          accent="bg-gradient-to-r from-emerald-400 to-green-500"
          icon={<Activity size={18} className="text-white"/>} />
        <KpiCard label="Expiring ≤30d" value={expiring}
          gradient="from-amber-50 to-orange-50/60" border="border-amber-100"
          iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
          accent="bg-gradient-to-r from-amber-400 to-orange-400"
          icon={<AlertTriangle size={18} className="text-white"/>} />
        <KpiCard label="Expired / Revoked" value={inactive}
          gradient="from-red-50 to-rose-50/60" border="border-red-100"
          iconBg="bg-gradient-to-br from-red-500 to-rose-600"
          accent="bg-gradient-to-r from-red-400 to-rose-500"
          icon={<Ban size={18} className="text-white"/>} />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search client or machine ID…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white transition-all" />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'revoked', label: 'Revoked' },
            ].map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowGen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-200 transition-all">
            <Plus size={15}/> Generate License
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
            <RefreshCw size={22} className="animate-spin text-indigo-400"/>
            <span className="text-sm">Loading licenses…</span>
          </div>
        ) : licenses.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
              <KeyRound size={26} className="text-gray-300"/>
            </div>
            <p className="text-sm font-medium text-gray-400">No licenses found</p>
            <p className="text-xs text-gray-300">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  {[
                    { label: 'Client', align: 'left' },
                    { label: 'Machine ID', align: 'left' },
                    { label: 'Seats', align: 'left' },
                    { label: 'Issued', align: 'left' },
                    { label: 'Expiry', align: 'left' },
                    { label: 'Status', align: 'left' },
                    { label: 'Key', align: 'right' },
                    { label: 'Actions', align: 'right' },
                  ].map(h => (
                    <th key={h.label}
                      className={`px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-${h.align}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {licenses.map(lic => (
                  <tr key={lic.id} className="hover:bg-slate-50/70 transition-colors group">

                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                          {lic.client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{lic.client.name}</p>
                          <p className="text-xs text-gray-400">{lic.client.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Machine ID */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 max-w-[180px]">
                        {lic.machineId.split('|').map((mid, i) => (
                          <span key={i} className="font-mono text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-lg truncate block" title={mid.trim()}>
                            {mid.trim()}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Seats */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold">
                        {lic.seats}
                      </span>
                    </td>

                    {/* Issued */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-600 font-medium">
                        {new Date(lic.issued).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-600 font-medium">
                        {new Date(lic.expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge expiry={lic.expiry} status={lic.status} />
                    </td>

                    {/* Key */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setViewKey(lic)}
                          className="font-mono text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition-colors max-w-[90px] truncate">
                          {lic.licenseKey.slice(0, 10)}…
                        </button>
                        <CopyBtn text={lic.licenseKey}/>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => download(lic.id, lic.fileName)} title="Download .lic"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Download size={14}/>
                        </button>
                        {lic.status === 'revoked'
                          ? <button onClick={() => unrevoke(lic.id)} title="Restore license"
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <ShieldCheck size={14}/>
                            </button>
                          : <button onClick={() => revoke(lic.id)} title="Revoke license"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <ShieldOff size={14}/>
                            </button>
                        }
                        <button onClick={() => { setExtendTarget(lic); setExtendExpiry('') }} title="Extend expiry"
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <CalendarDays size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}
        {!loading && licenses.length > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} label="license" />
        )}
      </div>

      {/* ── View Key Modal ──────────────────────────────── */}
      {viewKey && (
        <Modal title="License Key" subtitle={viewKey.client.name} onClose={() => setViewKey(null)}>
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl p-4">
              <p className="font-mono text-xs text-emerald-400 break-all leading-relaxed select-all">
                {viewKey.licenseKey}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Machine ID</p>
                <p className="font-mono text-xs text-gray-700 truncate">{viewKey.machineId}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">File Name</p>
                <p className="font-mono text-xs text-gray-700 truncate">{viewKey.fileName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(viewKey.licenseKey)} className={BTN_GHOST}>
                <Copy size={14}/> Copy Key
              </button>
              <button onClick={() => download(viewKey.id, viewKey.fileName)} className={BTN_PRIMARY + ' flex-1'}>
                <Download size={14}/> Download .lic
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Generate Modal ──────────────────────────────── */}
      {showGen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowGen(false); setError('') } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500 flex-shrink-0" />
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                  <KeyRound size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Generate License</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Create a new signed license key</p>
                </div>
              </div>
              <button onClick={() => { setShowGen(false); setError('') }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={16}/>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form onSubmit={generate} className="space-y-5" id="gen-form">

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <X size={14} className="flex-shrink-0"/>
                    {error}
                  </div>
                )}

                {/* ── Step 1: Client ── */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Select Client</span>
                  </div>
                  <select value={genForm.clientId} onChange={e => setGenForm({...genForm, clientId: e.target.value})}
                    required className={INPUT}>
                    <option value="">Choose a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
                  </select>
                </div>

                {/* ── Step 2: Seats + Expiry ── */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Seats & Expiry</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Seats counter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Number of Seats</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                        <button type="button" onClick={() => updateSeats(genForm.seats - 1)}
                          className="px-3 py-2.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-bold text-lg leading-none flex-shrink-0">
                          −
                        </button>
                        <div className="flex-1 text-center">
                          <span className="text-lg font-black text-gray-900">{genForm.seats}</span>
                          <span className="text-xs text-gray-400 block leading-none">seat{genForm.seats !== 1 ? 's' : ''}</span>
                        </div>
                        <button type="button" onClick={() => updateSeats(genForm.seats + 1)}
                          className="px-3 py-2.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-bold text-lg leading-none flex-shrink-0">
                          +
                        </button>
                      </div>
                    </div>
                    {/* Expiry */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Expiry Date <span className="text-red-500">*</span></label>
                      <input type="date" value={genForm.expiry}
                        onChange={e => setGenForm({...genForm, expiry: e.target.value})}
                        required className={INPUT}/>
                    </div>
                  </div>
                </div>

                {/* ── Step 3: Machine IDs (dynamic) ── */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Machine IDs</span>
                    </div>
                    <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                      {genForm.seats} required
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {genForm.machineIds.map((mid, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={mid}
                          onChange={e => updateMachineId(idx, e.target.value)}
                          placeholder={`Machine ${idx + 1} ID — e.g. A1B2-C3D4-E5F6`}
                          required
                          className={INPUT + ' font-mono text-xs'}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[9px] flex-shrink-0">i</span>
                    Each seat requires a unique machine identifier
                  </p>
                </div>

                {/* ── Notes ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes <span className="text-gray-300">(optional)</span></label>
                  <textarea value={genForm.notes} onChange={e => setGenForm({...genForm, notes: e.target.value})}
                    rows={2} placeholder="Internal notes about this license…" className={`${INPUT} resize-none`}/>
                </div>

              </form>
            </div>

            {/* Sticky footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => { setShowGen(false); setError('') }} className={BTN_GHOST + ' flex-1'}>
                Cancel
              </button>
              <button type="submit" form="gen-form" disabled={submitting} className={BTN_PRIMARY + ' flex-1'}>
                {submitting
                  ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating…</>
                  : <><KeyRound size={14}/> Generate License</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extend Modal ────────────────────────────────── */}
      {extendTarget && (
        <Modal
          title="Extend License"
          subtitle={`${extendTarget.client.name} · Current expiry: ${new Date(extendTarget.expiry).toLocaleDateString()}`}
          onClose={() => setExtendTarget(null)}
        >
          <form onSubmit={extend} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Expiry Date <span className="text-red-500">*</span></label>
              <input type="date" value={extendExpiry} onChange={e => setExtendExpiry(e.target.value)} required className={INPUT}/>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setExtendTarget(null)} className={BTN_GHOST + ' flex-1'}>Cancel</button>
              <button type="submit" disabled={submitting} className={BTN_PRIMARY + ' flex-1'}>
                {submitting ? 'Extending…' : <><CalendarDays size={14}/> Extend</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16}/>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
