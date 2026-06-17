'use client'

import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface ActivityRow {
  id: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
  createdAt: string
}

const ACTION_BADGE: Record<string, string> = {
  CREATE:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
  DELETE:   'bg-red-50 text-red-700 border border-red-100',
  REVOKE:   'bg-orange-50 text-orange-700 border border-orange-100',
  GENERATE: 'bg-blue-50 text-blue-700 border border-blue-100',
  EXTEND:   'bg-violet-50 text-violet-700 border border-violet-100',
  UPDATE:   'bg-slate-50 text-slate-600 border border-slate-100',
}

function actionBadge(action: string): string {
  for (const key of Object.keys(ACTION_BADGE)) {
    if (action.toUpperCase().includes(key)) return ACTION_BADGE[key]
  }
  return 'bg-gray-50 text-gray-600 border border-gray-100'
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [actions, setActions] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)

  async function fetchActivity(p = page, s = search, a = actionFilter) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (s) params.set('search', s)
      if (a) params.set('action', a)
      const res = await fetch(`/api/activity?${params}`)
      const data = await res.json()
      setRows(data.rows || [])
      setTotal(data.total || 0)
      setPage(data.page || 1)
      setPages(data.pages || 1)
      if (data.actions) setActions(data.actions)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchActivity(1, search, actionFilter) }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchActivity(1, search, actionFilter)
  }

  function handleActionChange(a: string) {
    setActionFilter(a)
    setPage(1)
    fetchActivity(1, search, a)
  }

  function goToPage(p: number) {
    setPage(p)
    fetchActivity(p, search, actionFilter)
  }

  return (
    <div className="space-y-5">

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-slate-400 to-gray-500" />
        <div className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => handleActionChange(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-500" />
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Activity Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">Audit trail of all admin actions</p>
          </div>
          {total > 0 && (
            <span className="text-xs font-semibold text-gray-500 bg-slate-50 border border-gray-100 px-3 py-1 rounded-lg">
              {total} entries
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No activity found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Action</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Entity Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap tabular-nums">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${actionBadge(row.action)}`}>
                        {row.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{row.entityType || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-sm truncate">{row.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50/40">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of <span className="font-semibold text-gray-700">{total}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === pages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
