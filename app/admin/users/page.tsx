'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Search } from 'lucide-react'
import { UserTable } from '@/components/admin/UserTable'
import type { PlanWithCount, UserWithPlan } from '@/types'
import { formatDate } from '@/lib/utils'

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [plans, setPlans] = useState<PlanWithCount[]>([])
  const [users, setUsers] = useState<UserWithPlan[]>([])

  const fetchData = useCallback(async () => {
    const [plansRes, usersRes] = await Promise.all([
      fetch('/api/subscriptions'),
      fetch('/api/users'),
    ])
    const plansData = await plansRes.json()
    const usersData = await usersRes.json()
    setPlans(plansData.plans ?? [])
    setUsers(usersData.users ?? [])
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function exportCSV() {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Plan', 'Joined']
    const rows = users.map((u) => [
      u.name,
      u.email,
      u.role,
      u.status,
      u.plan?.name ?? 'No Plan',
      formatDate(u.createdAt),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arc-pem-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Plans</option>
              <option value="NONE">No Plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <UserTable search={search} statusFilter={statusFilter} planFilter={planFilter} />
      </div>
    </div>
  )
}
