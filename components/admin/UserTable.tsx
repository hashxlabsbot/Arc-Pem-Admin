'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import type { UserWithPlan, PlanWithCount } from '@/types'

interface UserTableProps {
  search: string
  statusFilter: string
  planFilter: string
}

const PAGE_SIZE = 10

export function UserTable({ search, statusFilter, planFilter }: UserTableProps) {
  const [users, setUsers] = useState<UserWithPlan[]>([])
  const [plans, setPlans] = useState<PlanWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, plansRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/subscriptions'),
      ])
      const usersData = await usersRes.json()
      const plansData = await plansRes.json()
      setUsers(usersData.users ?? [])
      setPlans(plansData.plans ?? [])
    } catch {
      // silently fail, show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Filter users
  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || statusFilter === 'ALL' || u.status === statusFilter
    const matchPlan =
      !planFilter ||
      planFilter === 'ALL' ||
      (planFilter === 'NONE' ? !u.planId : u.planId === planFilter)
    return matchSearch && matchStatus && matchPlan
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleStatusChange(userId: string, status: string) {
    setActionLoading(userId + '_status')
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePlanChange(userId: string, planId: string) {
    setActionLoading(userId + '_plan')
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planId === 'NONE' ? null : planId }),
      })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(userId: string, userName: string) {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return
    setActionLoading(userId + '_delete')
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete user')
        return
      }
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              paginated.map((user, idx) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="role" value={user.role}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" value={user.status}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.plan?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Status Change */}
                      <select
                        value={user.status}
                        disabled={actionLoading === user.id + '_status'}
                        onChange={(e) => handleStatusChange(user.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>

                      {/* Plan Change */}
                      <select
                        value={user.planId ?? 'NONE'}
                        disabled={actionLoading === user.id + '_plan'}
                        onChange={(e) => handlePlanChange(user.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="NONE">No Plan</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      {/* Delete */}
                      {user.role !== 'ADMIN' && (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={actionLoading === user.id + '_delete'}
                          onClick={() => handleDelete(user.id, user.name)}
                          className="px-2 py-1"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length} users
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 transition"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded text-sm font-medium transition ${
                  p === page
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
