'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Copy, Check, ShieldOff, Trash2, Key } from 'lucide-react'

interface Client {
  id: string
  name: string
  email: string
}

interface ApiKey {
  id: string
  clientId: string
  client: { name: string; email: string }
  name: string
  keyPrefix: string
  scopes: string
  status: string
  createdAt: string
  expiresAt?: string
}

const ALL_SCOPES = ['read', 'write', 'admin']

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ clientId: '', name: '', scopes: [] as string[], expiresAt: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function fetchAll() {
    setLoading(true)
    try {
      const [keyRes, clientRes] = await Promise.all([
        fetch('/api/api-keys'),
        fetch('/api/clients'),
      ])
      const keyData = await keyRes.json()
      const clientData = await clientRes.json()
      setApiKeys(keyData.apiKeys || [])
      setClients(clientData.clients || [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to create API key')
        return
      }
      const data = await res.json()
      setNewRawKey(data.rawKey)
      setShowModal(false)
      setForm({ clientId: '', name: '', scopes: [], expiresAt: '' })
      fetchAll()
    } catch {
      setError('Failed to create API key')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/api-keys/${id}/revoke`, { method: 'PATCH' })
    fetchAll()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchAll()
  }

  function toggleScope(scope: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s) => s !== scope) : [...f.scopes, scope],
    }))
  }

  async function copyKey() {
    if (!newRawKey) return
    await navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = apiKeys.filter((k) => {
    const matchSearch =
      !search ||
      k.client.name.toLowerCase().includes(search.toLowerCase()) ||
      k.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || k.status === statusFilter
    return matchSearch && matchStatus
  })

  const activeCount = apiKeys.filter((k) => k.status === 'active').length
  const revokedCount = apiKeys.filter((k) => k.status === 'revoked').length

  return (
    <div className="space-y-5">

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Key size={18} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active Keys</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-rose-100 border border-red-200/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <ShieldOff size={18} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{revokedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Revoked Keys</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-end shadow-sm">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={16} />
            Create API Key
          </button>
        </div>
      </div>

      {/* New Key Banner */}
      {newRawKey && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="p-4">
            <p className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check size={12} className="text-emerald-600" />
              </span>
              API Key created — copy it now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-4 py-3">
              <code className="text-sm font-mono text-gray-800 flex-1 break-all">{newRawKey}</code>
              <button
                onClick={copyKey}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  copied ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setNewRawKey(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search API keys..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No API keys found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Prefix</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Scopes</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Created</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Expires</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((k) => {
                  let scopes: string[] = []
                  try { scopes = JSON.parse(k.scopes) } catch {}
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900">{k.client.name}</p>
                        <p className="text-xs text-gray-400">{k.client.email}</p>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{k.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-600 bg-slate-50 border border-gray-100 px-2 py-0.5 rounded">
                          {k.keyPrefix}...
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {scopes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-semibold capitalize">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${
                          k.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {k.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">{new Date(k.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          {k.status === 'active' && (
                            <button onClick={() => handleRevoke(k.id)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Revoke">
                              <ShieldOff size={15} />
                            </button>
                          )}
                          <button onClick={() => setDeleteId(k.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={15} />
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Create API Key</h2>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl border border-red-100">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Client <span className="text-red-500">*</span></label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Key Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  placeholder="e.g. Production API Key"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Scopes</label>
                <div className="flex gap-4">
                  {ALL_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggleScope(scope)}
                        className="rounded border-gray-300 text-blue-600" />
                      <span className="capitalize font-medium">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Expires At <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setError('') }}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600" />
            <div className="p-6">
              <h2 className="text-base font-bold text-gray-900 mb-2">Delete API Key</h2>
              <p className="text-sm text-gray-500 mb-6">This will permanently delete the API key.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
