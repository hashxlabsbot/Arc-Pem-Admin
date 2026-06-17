'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, RotateCcw } from 'lucide-react'

type Row = {
  id: string
  userName: string
  userEmail: string
  planName: string
  amount: number
  utr: string
  status: string
  createdAt: string
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending:  { label: 'Pending',  className: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock size={11} /> },
    approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={11} /> },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-600 border-red-200',          icon: <XCircle size={11} /> },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.className}`}>
      {s.icon}
      {s.label}
    </span>
  )
}

export function PaymentsTable({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows]             = useState(initial)
  const [loading, setLoading]       = useState<string | null>(null)
  const [rejectId, setRejectId]     = useState<string | null>(null)
  const [rejectReason, setReason]   = useState('')
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function approve(id: string) {
    setLoading(id)
    try {
      const res = await fetch('/api/payments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(r => r.map(row => row.id === id ? { ...row, status: 'approved' } : row))
      if (data.emailSent === false) {
        showToast(`Plan activated but email failed: ${data.emailError}`, false)
      } else {
        showToast('Payment approved — confirmation email sent to user.', true)
      }
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed', false)
    } finally {
      setLoading(null)
    }
  }

  async function reject(id: string) {
    setLoading(id)
    try {
      const res = await fetch('/api/payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id, reason: rejectReason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(r => r.map(row => row.id === id ? { ...row, status: 'rejected' } : row))
      setRejectId(null)
      setReason('')
      if (data.emailSent === false) {
        showToast(`Payment rejected but email failed: ${data.emailError}`, false)
      } else {
        showToast('Payment rejected — user notified by email.', true)
      }
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed', false)
    } finally {
      setLoading(null)
    }
  }

  async function reset(id: string) {
    setLoading(id)
    try {
      const res = await fetch('/api/payments/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(r => r.map(row => row.id === id ? { ...row, status: 'pending' } : row))
      showToast('Payment reset to pending — you can now approve again.', true)
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed', false)
    } finally {
      setLoading(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertCircle size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No payment submissions yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-1">Reject Payment</h3>
            <p className="text-sm text-gray-500 mb-4">Optionally add a reason — it will be included in the rejection email sent to the user.</p>
            <textarea
              value={rejectReason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. UTR not found in our records, please recheck..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              rows={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectId(null); setReason('') }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => reject(rejectId)}
                disabled={loading === rejectId}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === rejectId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject & Notify
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['User', 'Plan', 'Amount', 'UTR / Txn ID', 'Submitted', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-gray-900 text-sm">{row.userName}</div>
                  <div className="text-xs text-gray-400">{row.userEmail}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-gray-700">{row.planName}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-bold text-gray-900">₹{row.amount.toLocaleString('en-IN')}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{row.utr}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-5 py-3.5">
                  {row.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approve(row.id)}
                        disabled={!!loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                      >
                        {loading === row.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle size={12} />}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectId(row.id)}
                        disabled={!!loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold disabled:opacity-50 transition-colors"
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => reset(row.id)}
                      disabled={!!loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold disabled:opacity-50 transition-colors"
                    >
                      {loading === row.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
