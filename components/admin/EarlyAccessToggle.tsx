'use client'

import { useEffect, useState } from 'react'
import { Rocket, CheckCircle2, AlertCircle, Users } from 'lucide-react'

export function EarlyAccessToggle() {
  const [open, setOpen] = useState(false)
  const [cohort, setCohort] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/settings/early-access')
      .then(r => r.json())
      .then(d => {
        setOpen(Boolean(d.open))
        if (typeof d.earlyAccessUsers === 'number') setCohort(d.earlyAccessUsers)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle() {
    const next = !open
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/early-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update')
      setOpen(next)
      setMsg({ text: next ? 'Early access mode is now ON.' : 'Early access mode is now OFF.', ok: true })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Failed to update', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
      <div className="p-6">
        <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <Rocket size={15} />
          </div>
          Early Access Mode
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Registration and payments always work. Turn this <strong>on</strong> for the launch event:
          new buyers pay now but their license key is held until you ship the product. Turn it
          <strong> off</strong> for the normal flow once you&apos;re ready to ship.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Early access</p>
            <p className="text-xs mt-0.5">
              {loading ? (
                <span className="text-gray-400">Loading…</span>
              ) : open ? (
                <span className="text-amber-600 font-medium">On — new buyers pay now, license shipped later</span>
              ) : (
                <span className="text-gray-500 font-medium">Off — normal flow (license issued as usual)</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={loading || saving}
            role="switch"
            aria-checked={open}
            aria-label="Toggle early-access registration"
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              open ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                open ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {cohort !== null && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Users size={15} className="text-orange-500" />
            <span className="font-semibold text-gray-900 tabular-nums">{cohort}</span>
            early-access {cohort === 1 ? 'user' : 'users'} acquired so far
          </div>
        )}

        {msg && (
          <div className={`mt-4 flex items-center gap-2 text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
