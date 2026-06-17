'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Check, Eye, EyeOff, AlertCircle, Mail, User, Building2, Lock } from 'lucide-react'
import { PASSWORD_RULES, passwordStrength } from '@/lib/password'

interface Plan { id: string; name: string; price: number; description?: string }

const INPUT = 'w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white transition-all'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', company: '', planId: '' })
  const [plans, setPlans]           = useState<Plan[]>([])
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [showPw, setShowPw]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwTouched, setPwTouched]   = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions').then(r => r.json()).then(d => setPlans(d.plans ?? [])).catch(() => {})
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const strength  = passwordStrength(form.password)
  const rulesDone = PASSWORD_RULES.filter(r => r.test(form.password))
  const allRulesPass = rulesDone.length === PASSWORD_RULES.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPwTouched(true)

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (!allRulesPass) {
      setError('Please choose a stronger password meeting all requirements.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password, company: form.company.trim(), planId: form.planId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed.') }
      else          { router.push('/login?registered=true') }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200 mb-4">
            <UserPlus size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">Create account</h2>
          <p className="text-slate-500 text-sm mt-1">Join ARC PEM to manage your projects</p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input name="name" type="text" value={form.name} onChange={handleChange} placeholder="Arjun Sharma" required className={INPUT} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required className={INPUT} />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input name="company" type="text" value={form.company} onChange={handleChange} placeholder="BuildCo Pvt. Ltd." className={INPUT} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                name="password" type={showPw ? 'text' : 'password'} value={form.password}
                onChange={handleChange} onFocus={() => setPwTouched(true)}
                placeholder="Create a strong password" required
                className={INPUT + ' pr-11'}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>

            {/* Strength meter */}
            {pwTouched && form.password.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {/* Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-slate-100'}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold w-20 text-right ${
                    strength.score <= 2 ? 'text-red-500' : strength.score === 3 ? 'text-yellow-500' : 'text-emerald-600'
                  }`}>{strength.label}</span>
                </div>
                {/* Rules checklist */}
                <div className="grid grid-cols-1 gap-1">
                  {PASSWORD_RULES.map(rule => {
                    const ok = rule.test(form.password)
                    return (
                      <div key={rule.id} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${ok ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {ok && <Check size={9} className="text-white" strokeWidth={3}/>}
                        </div>
                        <span className={`text-xs transition-colors ${ok ? 'text-emerald-700' : 'text-slate-400'}`}>{rule.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                onChange={handleChange} placeholder="Repeat your password" required
                className={INPUT + ` pr-11 ${form.confirmPassword && form.confirmPassword !== form.password ? 'border-red-300 focus:ring-red-400' : ''}`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {form.confirmPassword && form.confirmPassword !== form.password && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={11}/> Passwords do not match
              </p>
            )}
            {form.confirmPassword && form.confirmPassword === form.password && (
              <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                <Check size={11} strokeWidth={3}/> Passwords match
              </p>
            )}
          </div>

          {/* Plan selector */}
          {plans.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Subscription Plan <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${form.planId === '' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <input type="radio" name="planId" value="" checked={form.planId === ''} onChange={() => setForm(f => ({ ...f, planId: '' }))} className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${form.planId === '' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                    {form.planId === '' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">No plan yet</p>
                    <p className="text-xs text-slate-400">I&apos;ll choose later</p>
                  </div>
                </label>
                {plans.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${form.planId === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <input type="radio" name="planId" value={p.id} checked={form.planId === p.id} onChange={() => setForm(f => ({ ...f, planId: p.id }))} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${form.planId === p.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                      {form.planId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      {p.description && <p className="text-xs text-slate-400">{p.description}</p>}
                    </div>
                    {p.price > 0 && (
                      <span className="text-sm font-bold text-indigo-600 flex-shrink-0">
                        ₹{p.price.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-400">/mo</span>
                      </span>
                    )}
                    {form.planId === p.id && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 mt-2
                       bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                       disabled:from-indigo-300 disabled:to-violet-300
                       text-white font-semibold rounded-xl shadow-md shadow-indigo-200
                       transition-all active:scale-[0.98] text-sm">
            {loading ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Creating account…</>
            ) : (
              <><UserPlus size={16}/> Create account</>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 font-medium">Already registered?</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <Link href="/login"
          className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl border-2 border-slate-200
                     text-slate-700 font-semibold text-sm hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50
                     transition-all active:scale-[0.98]">
          Sign in instead
        </Link>
      </div>
    </div>
  )
}
