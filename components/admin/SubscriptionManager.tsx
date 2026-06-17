'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PlanWithCount } from '@/types'

interface PlanForm {
  name: string
  price: string
  period: string
  description: string
  maxProjects: string
  maxUsers: string
  features: string
  isActive: boolean
}

const emptyForm: PlanForm = {
  name: '',
  price: '',
  period: 'month',
  description: '',
  maxProjects: '10',
  maxUsers: '1',
  features: '',
  isActive: true,
}

export function SubscriptionManager() {
  const [plans, setPlans] = useState<PlanWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PlanForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions')
      const data = await res.json()
      setPlans(data.plans ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setDrawerOpen(true)
  }

  function openEdit(plan: PlanWithCount) {
    setEditingId(plan.id)
    setForm({
      name: plan.name,
      price: String(plan.price),
      period: plan.period,
      description: plan.description,
      maxProjects: String(plan.maxProjects),
      maxUsers: String(plan.maxUsers),
      features: JSON.parse(plan.features ?? '[]').join('\n'),
      isActive: plan.isActive,
    })
    setError('')
    setDrawerOpen(true)
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const featuresArr = form.features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)

    const payload = {
      name: form.name,
      price: parseFloat(form.price) || 0,
      period: form.period,
      description: form.description,
      maxProjects: parseInt(form.maxProjects) || 10,
      maxUsers: parseInt(form.maxUsers) || 1,
      features: JSON.stringify(featuresArr),
      isActive: form.isActive,
    }

    try {
      const res = await fetch(
        editingId ? `/api/subscriptions/${editingId}` : '/api/subscriptions',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save plan')
        return
      }

      setDrawerOpen(false)
      await fetchPlans()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(plan: PlanWithCount) {
    const count = plan._count?.users ?? plan.userCount ?? 0
    if (count > 0) {
      alert(`Cannot delete "${plan.name}" — ${count} user(s) are currently on this plan.`)
      return
    }
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return

    setDeleteLoading(plan.id)
    try {
      const res = await fetch(`/api/subscriptions/${plan.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete plan')
        return
      }
      await fetchPlans()
    } finally {
      setDeleteLoading(null)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={15} />
          Add Plan
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Limits</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No plans found. Create your first plan.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const userCount = plan._count?.users ?? plan.userCount ?? 0
                  const features = JSON.parse(plan.features ?? '[]') as string[]

                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{plan.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{plan.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {features.slice(0, 3).map((f) => (
                            <span key={f} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {f}
                            </span>
                          ))}
                          {features.length > 3 && (
                            <span className="text-xs text-gray-400">+{features.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{formatCurrency(plan.price)}</span>
                        {plan.price > 0 && (
                          <span className="text-gray-400 text-xs">/{plan.period}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{userCount}</span>
                        <span className="text-gray-400 text-xs"> subscribers</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <div>{plan.maxProjects === 9999 ? 'Unlimited' : plan.maxProjects} projects</div>
                        <div>{plan.maxUsers === 9999 ? 'Unlimited' : plan.maxUsers} users</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            plan.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {plan.isActive ? <Check size={11} /> : <X size={11} />}
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDate(plan.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(plan)}
                            className="px-2 py-1"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={deleteLoading === plan.id}
                            onClick={() => handleDelete(plan)}
                            className="px-2 py-1"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer / Modal */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {editingId ? 'Edit Plan' : 'Create New Plan'}
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Plan Name *"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Studio"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Price (₹) *"
                  name="price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="9999"
                  required
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Period</label>
                  <select
                    name="period"
                    value={form.period}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Description *</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe this plan..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Max Projects"
                  name="maxProjects"
                  type="number"
                  min="1"
                  value={form.maxProjects}
                  onChange={handleChange}
                />
                <Input
                  label="Max Users"
                  name="maxUsers"
                  type="number"
                  min="1"
                  value={form.maxUsers}
                  onChange={handleChange}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Features <span className="text-gray-400 font-normal">(one per line)</span>
                </label>
                <textarea
                  name="features"
                  value={form.features}
                  onChange={handleChange}
                  placeholder={"Expense tracking\nCustom reports\nPriority support"}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                </label>
                <span className="text-sm text-gray-700 font-medium">Active</span>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setDrawerOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={submitting}
                onClick={handleSubmit}
                className="flex-1"
              >
                {editingId ? 'Save Changes' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
