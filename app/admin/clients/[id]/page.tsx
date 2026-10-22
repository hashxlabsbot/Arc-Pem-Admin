'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, CreditCard,
  Pencil, Download, ShieldCheck, Key, StickyNote,
} from 'lucide-react'

interface License {
  id: string; machineId: string; seats: number; issued: string
  expiry: string; status: string; fileName: string; notes?: string; createdAt: string
}
interface ApiKey {
  id: string; name: string; keyPrefix: string; scopes: string
  status: string; createdAt: string; expiresAt?: string
}
interface ClientNote { id: string; note: string; createdAt: string }
interface Client {
  id: string; name: string; email: string; phone?: string; company?: string
  address?: string; plan: string; status: string; paymentStatus: string
  notes?: string; createdAt: string
  licenses: License[]; apiKeys: ApiKey[]; clientNotes: ClientNote[]
}

const PLAN_BADGE: Record<string, string> = {
  standard:     'bg-indigo-50 text-indigo-700 border border-indigo-100',
  professional: 'bg-blue-50 text-blue-700 border border-blue-100',
  enterprise:   'bg-purple-50 text-purple-700 border border-purple-100',
}
const PAY_BADGE: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  overdue: 'bg-red-50 text-red-700 border border-red-100',
}
const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  inactive:  'bg-slate-50 text-slate-600 border border-slate-100',
  suspended: 'bg-red-50 text-red-700 border border-red-100',
  revoked:   'bg-red-50 text-red-700 border border-red-100',
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const exp = new Date(dateStr)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', address: '',
    plan: 'standard', notes: '', status: 'active', paymentStatus: 'pending',
  })
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'licenses' | 'apikeys'>('licenses')

  async function fetchClient() {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${params.id}`)
      if (!res.ok) { setError('Client not found'); return }
      const data = await res.json()
      setClient(data.client)
      setForm({
        name: data.client.name, email: data.client.email,
        phone: data.client.phone || '', company: data.client.company || '',
        address: data.client.address || '', plan: data.client.plan,
        notes: data.client.notes || '', status: data.client.status,
        paymentStatus: data.client.paymentStatus,
      })
    } catch {
      setError('Failed to load client')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClient() }, [params.id])

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setShowEditModal(false); fetchClient() }
    } catch {}
    setSubmitting(false)
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim()) return
    setAddingNote(true)
    try {
      await fetch(`/api/clients/${params.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      })
      setNoteText('')
      fetchClient()
    } catch {}
    setAddingNote(false)
  }

  async function downloadLicense(licenseId: string, fileName: string) {
    const res = await fetch(`/api/licenses/${licenseId}/download`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Loading...</div>
  if (error || !client) return <div className="py-16 text-center text-red-400">{error || 'Not found'}</div>

  return (
    <div className="space-y-5">

      {/* Back + Edit row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/clients')}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{client.name}</h2>
          <p className="text-xs text-gray-400">{client.email}</p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="p-6">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Building2 size={16} className="text-violet-500" />
            Client Information
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Mail size={11} /> Email</p>
              <p className="font-semibold text-gray-800">{client.email}</p>
            </div>
            {client.phone && (
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Phone size={11} /> Phone</p>
                <p className="font-semibold text-gray-800">{client.phone}</p>
              </div>
            )}
            {client.company && (
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 size={11} /> Company</p>
                <p className="font-semibold text-gray-800">{client.company}</p>
              </div>
            )}
            {client.address && (
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MapPin size={11} /> Address</p>
                <p className="font-semibold text-gray-800">{client.address}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><CreditCard size={11} /> Plan</p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${PLAN_BADGE[client.plan] || 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                {client.plan}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Payment</p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${PAY_BADGE[client.paymentStatus] || 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                {client.paymentStatus}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${STATUS_BADGE[client.status] || 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                {client.status}
              </span>
            </div>
          </div>
          {client.notes && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'licenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck size={14} />
          Licenses ({client.licenses.length})
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'apikeys' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key size={14} />
          API Keys ({client.apiKeys.length})
        </button>
      </div>

      {/* Licenses Table */}
      {activeTab === 'licenses' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Licenses</h3>
          </div>
          {client.licenses.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No licenses yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Machine ID</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Seats</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Issued</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Expiry</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {client.licenses.map((lic) => {
                    const days = daysUntil(lic.expiry)
                    return (
                      <tr key={lic.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-700 bg-slate-50/50">{lic.machineId}</td>
                        <td className="px-5 py-3.5 text-gray-700 tabular-nums">{lic.seats}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">{new Date(lic.issued).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">{new Date(lic.expiry).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize w-fit ${STATUS_BADGE[lic.status] || 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                              {lic.status}
                            </span>
                            {lic.status === 'active' && (
                              <span className={`text-[10px] font-medium ${days < 0 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : days <= 30 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                {days < 0 ? `${Math.abs(days)}d expired` : `${days}d left`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            <button
                              onClick={() => downloadLicense(lic.id, lic.fileName)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                            >
                              <Download size={13} />
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* API Keys Table */}
      {activeTab === 'apikeys' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">API Keys</h3>
          </div>
          {client.apiKeys.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No API keys yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Prefix</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Scopes</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {client.apiKeys.map((key) => {
                    let scopes: string[] = []
                    try { scopes = JSON.parse(key.scopes) } catch {}
                    return (
                      <tr key={key.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-gray-800">{key.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs text-gray-600 bg-slate-50 border border-gray-100 px-2 py-0.5 rounded">{key.keyPrefix}...</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {scopes.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-semibold capitalize">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${STATUS_BADGE[key.status] || 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                            {key.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">{new Date(key.createdAt).toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
        <div className="p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
            <StickyNote size={15} className="text-amber-500" />
            Notes
          </h3>
          <form onSubmit={handleAddNote} className="mb-4">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
            />
            <button
              type="submit"
              disabled={addingNote || !noteText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {addingNote ? 'Adding...' : 'Add Note'}
            </button>
          </form>
          <div className="space-y-3">
            {client.clientNotes.length === 0 ? (
              <p className="text-sm text-gray-400">No notes yet.</p>
            ) : (
              client.clientNotes.map((n) => (
                <div key={n.id} className="bg-slate-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-sm text-gray-700">{n.note}</p>
                  <p className="text-xs text-gray-400 mt-1.5 tabular-nums">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Edit Client</h2>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plan</label>
                  <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="standard">Standard</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Payment</label>
                  <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
