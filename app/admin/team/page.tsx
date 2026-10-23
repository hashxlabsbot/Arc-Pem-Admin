'use client'

import { useState } from 'react'
import {
  UserCog, Plus, Search, Pencil, Trash2, X, Eye, EyeOff, RefreshCw,
  Copy, Check, ShieldCheck, FileText, Ban, PlayCircle,
} from 'lucide-react'
import { usePaginatedList } from '@/lib/use-paginated-list'
import { Pagination } from '@/components/admin/Pagination'
import { PASSWORD_RULES, passwordStrength, validatePassword } from '@/lib/password'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'BLOG_EDITOR'
  status: string
  createdAt: string
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  BLOG_EDITOR: 'bg-blue-50 text-blue-700 border border-blue-100',
}
const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', BLOG_EDITOR: 'Blog Editor' }
const ROLE_ICON: Record<string, React.ElementType> = { ADMIN: ShieldCheck, BLOG_EDITOR: FileText }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  SUSPENDED: 'bg-red-50 text-red-700 border border-red-100',
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5'

const PW_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PW_LOWER = 'abcdefghijkmnopqrstuvwxyz'
const PW_DIGIT = '23456789'
const PW_SPECIAL = '!@#$%'
const PW_ALL = PW_UPPER + PW_LOWER + PW_DIGIT + PW_SPECIAL

function randChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Always satisfies every PASSWORD_RULES class — one guaranteed char per class, rest random, then shuffled. */
function genPassword(): string {
  const required = [randChar(PW_UPPER), randChar(PW_LOWER), randChar(PW_DIGIT), randChar(PW_SPECIAL)]
  const rest = Array.from({ length: 10 }, () => randChar(PW_ALL))
  const out = [...required, ...rest]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

/** Shared password input: generate button, show/hide, and a live strength meter against PASSWORD_RULES. */
function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  const strength = passwordStrength(value)
  const rulesDone = PASSWORD_RULES.filter((r) => r.test(value))
  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            className={inputCls}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Choose a strong password"
          />
          <button type="button" onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <button type="button" onClick={() => onChange(genPassword())}
          className="px-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 whitespace-nowrap">
          Generate
        </button>
      </div>
      {value && (
        <div className="mt-1.5">
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden flex gap-0.5">
            <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{strength.label} — {rulesDone.length}/{PASSWORD_RULES.length} requirements met</p>
        </div>
      )}
    </div>
  )
}

export default function TeamPage() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { items: team, pagination, stats, loading, setPage, refresh } = usePaginatedList<TeamMember>({
    url: '/api/team',
    itemsKey: 'team',
    search,
  })

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) { setDeleteTarget(null); refresh() }
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Could not delete this account.')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function toggleStatus(m: TeamMember) {
    const status = m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const res = await fetch(`/api/team/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) refresh()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not update status.')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog size={20} className="text-blue-500" /> Team
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total ?? 0} accounts · {stats.admins ?? 0} admin · {stats.editors ?? 0} blog editor
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={16} /> New team member
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
<table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : team.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No team members yet. Add one to get started.</td></tr>
            ) : (
              team.map((m) => {
                const RoleIcon = ROLE_ICON[m.role]
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="px-5 py-3 text-gray-600">{m.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] ?? ''}`}>
                        <RoleIcon size={11} /> {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status] ?? ''}`}>
                        {m.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleStatus(m)}
                          className={`p-1.5 rounded-lg transition ${m.status === 'ACTIVE' ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          title={m.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}>
                          {m.status === 'ACTIVE' ? <Ban size={15} /> : <PlayCircle size={15} />}
                        </button>
                        <button onClick={() => setEditing(m)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(m)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
</div>
        <Pagination pagination={pagination} onPageChange={setPage} label="team member" />
      </div>

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreated={refresh} />}
      {editing && <EditModal member={editing} onClose={() => setEditing(null)} onSaved={refresh} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500 mb-5">This permanently removes their account and login access. This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'BLOG_EDITOR'>('BLOG_EDITOR')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email and password are all required.')
      return
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      setError(pwCheck.errors[0])
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not create this account.'); return }
      setCreated({ email: email.trim().toLowerCase(), password })
      onCreated()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function copyCreds() {
    if (!created) return
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (created) {
    return (
      <ModalShell title="Account created" onClose={onClose}>
        <p className="text-sm text-gray-600 mb-4">
          Share these credentials with them directly — the password is shown only once and cannot be retrieved again.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 font-mono text-sm mb-4">
          <p><span className="text-gray-400">Email:</span> {created.email}</p>
          <p><span className="text-gray-400">Password:</span> {created.password}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={copyCreds} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">Done</button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="New team member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@arcpem.com" />
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <PasswordField value={password} onChange={setPassword} />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setRole('BLOG_EDITOR')}
              className={`px-3 py-2.5 rounded-lg text-sm font-semibold border text-left transition ${role === 'BLOG_EDITOR' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              Blog Editor
              <span className="block text-[11px] font-normal opacity-70">Blog section only</span>
            </button>
            <button type="button" onClick={() => setRole('ADMIN')}
              className={`px-3 py-2.5 rounded-lg text-sm font-semibold border text-left transition ${role === 'ADMIN' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              Admin
              <span className="block text-[11px] font-normal opacity-70">Full access</span>
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditModal({ member, onClose, onSaved }: { member: TeamMember; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<'ADMIN' | 'BLOG_EDITOR'>(member.role)
  const [resetPw, setResetPw] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (resetPw) {
      const pwCheck = validatePassword(password)
      if (!pwCheck.valid) { setError(pwCheck.errors[0]); return }
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (role !== member.role) body.role = role
      if (resetPw && password) body.password = password

      if (Object.keys(body).length === 0) { onClose(); return }

      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not save changes.'); return }
      onSaved()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Edit ${member.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}
        <div>
          <label className={labelCls}>Email</label>
          <p className="text-sm text-gray-500">{member.email}</p>
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setRole('BLOG_EDITOR')}
              className={`px-3 py-2.5 rounded-lg text-sm font-semibold border text-left transition ${role === 'BLOG_EDITOR' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              Blog Editor
            </button>
            <button type="button" onClick={() => setRole('ADMIN')}
              className={`px-3 py-2.5 rounded-lg text-sm font-semibold border text-left transition ${role === 'ADMIN' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              Admin
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={resetPw} onChange={(e) => setResetPw(e.target.checked)} className="rounded" />
          Reset password
        </label>
        {resetPw && (
          <div>
            <label className={labelCls}>New password</label>
            <PasswordField value={password} onChange={setPassword} />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
