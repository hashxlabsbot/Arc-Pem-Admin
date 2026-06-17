'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react'

export function TestEmailButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null)

  async function test() {
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/payments/test-email')
      const data = await res.json()
      setResult({ ok: data.ok, msg: data.ok ? data.message : data.error })
    } catch {
      setResult({ ok: false, msg: 'Request failed — check console' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
          {result.msg}
        </span>
      )}
      <button
        onClick={test}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
        Test SMTP
      </button>
    </div>
  )
}
