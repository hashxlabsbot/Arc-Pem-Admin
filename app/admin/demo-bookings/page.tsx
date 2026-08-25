'use client'

import { useState } from 'react'
import { Video, Mail, Phone, CalendarClock, ExternalLink, Copy, Check } from 'lucide-react'
import { usePaginatedList } from '@/lib/use-paginated-list'
import { Pagination } from '@/components/admin/Pagination'

interface DemoBooking {
  id: string
  name: string
  email: string
  whatsapp: string
  company?: string | null
  role?: string | null
  teamSize?: string | null
  preferredDate?: string | null
  preferredTime?: string | null
  meetLink?: string | null
  status: string
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border border-amber-100',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  CONTACTED: 'bg-blue-50 text-blue-700 border border-blue-100',
  FAILED:    'bg-red-50 text-red-700 border border-red-100',
}

export default function DemoBookingsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const {
    items: bookings,
    pagination,
    stats,
    loading,
    setPage,
    refresh,
  } = usePaginatedList<DemoBooking>({
    url: '/api/demo-bookings',
    itemsKey: 'bookings',
    search,
    filters: { status: statusFilter },
  })

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/demo-bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    refresh()
  }

  function copyLink(id: string, link: string) {
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const totalCount = stats.total ?? 0
  const confirmedCount = stats.confirmed ?? 0
  const pendingCount = stats.pending ?? 0

  return (
    <div className="space-y-5">

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Video size={18} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{totalCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Bookings</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Check size={18} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{confirmedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Meet Link Confirmed</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <CalendarClock size={18} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Needs Follow-up</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="p-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search name, email, WhatsApp, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CONTACTED">Contacted</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No demo bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Lead</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Company</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Slot</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Meet Link</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Video size={14} className="text-violet-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-gray-900 block">{b.name}</span>
                          {(b.role || b.teamSize) && (
                            <span className="text-[11px] text-gray-400">{[b.role, b.teamSize].filter(Boolean).join(' · ')}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Mail size={12} className="text-gray-400" />
                        {b.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs mt-1">
                        <Phone size={12} className="text-gray-400" />
                        {b.whatsapp}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      {b.company || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      {b.preferredDate || b.preferredTime
                        ? <>{b.preferredDate}<br />{b.preferredTime}</>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {b.meetLink ? (
                        <div className="flex items-center gap-1">
                          <a href={b.meetLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                            Join <ExternalLink size={11} />
                          </a>
                          <button onClick={() => copyLink(b.id, b.meetLink!)}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors" title="Copy link">
                            {copiedId === b.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={b.status}
                        onChange={(e) => updateStatus(b.id, e.target.value)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border focus:outline-none ${STATUS_BADGE[b.status] || 'bg-gray-50 text-gray-600 border-gray-100'}`}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs tabular-nums">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && bookings.length > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} label="booking" />
        )}
      </div>
    </div>
  )
}
