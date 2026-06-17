import { db } from '@/lib/db'
import { PaymentsTable } from '@/components/admin/PaymentsTable'
import { TestEmailButton } from '@/components/admin/TestEmailButton'
import { Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const payments = await db.pendingPayment.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Fetch user info for each payment
  const userIds = Array.from(new Set(payments.map(p => p.userId)))
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  })
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  const rows = payments.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    userName:  userMap[p.userId]?.name  ?? '—',
    userEmail: userMap[p.userId]?.email ?? '—',
  }))

  const pending  = rows.filter(r => r.status === 'pending').length
  const approved = rows.filter(r => r.status === 'approved').length
  const rejected = rows.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-400 mt-0.5">Review and approve UPI payment submissions from users.</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {pending} pending review
            </div>
          )}
          <TestEmailButton />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',  value: pending,  color: 'amber',   bg: 'bg-amber-50',   border: 'border-amber-200', text: 'text-amber-700'  },
          { label: 'Approved', value: approved, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
          { label: 'Rejected', value: rejected, color: 'red',     bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700'    },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-5 py-4`}>
            <p className={`text-3xl font-black tabular-nums ${s.text}`}>{s.value}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Wallet size={16} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Payment Submissions</h3>
            <p className="text-xs text-gray-400 mt-0.5">UPI transactions submitted by users for plan activation.</p>
          </div>
        </div>
        <PaymentsTable rows={rows} />
      </div>
    </div>
  )
}
