'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, ShieldAlert, ShieldOff } from 'lucide-react'

const MAX_CLIENT_ATTEMPTS = 5

// useSearchParams() requires a Suspense boundary (Next.js App Router).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')
  const [loading, setLoading]           = useState(false)
  // Client-side attempt tracking (server enforces the real limit)
  const [attempts, setAttempts]         = useState(0)
  const [locked, setLocked]             = useState(false)
  const [lockSeconds, setLockSeconds]   = useState(0)

  useEffect(() => {
    const err        = searchParams.get('error')
    const registered = searchParams.get('registered')
    if (err === 'unauthorized')       setError('You must be an admin to access the dashboard.')
    else if (err === 'CredentialsSignin') setError('Invalid email or password.')
    else if (err)                     setError('An error occurred. Please try again.')
    if (registered === 'true')        setSuccess('Account created! Please sign in.')
  }, [searchParams])

  // Countdown timer when locked
  useEffect(() => {
    if (!locked || lockSeconds <= 0) return
    const t = setInterval(() => {
      setLockSeconds(s => {
        if (s <= 1) { setLocked(false); setAttempts(0); clearInterval(t); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [locked, lockSeconds])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (locked) return
    setError('')
    setSuccess('')

    if (!email || !password) { setError('Please fill in all fields.'); return }

    setLoading(true)
    const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false })
    setLoading(false)

    if (result?.error) {
      const isLocked = result.error.toLowerCase().includes('locked') || result.error.toLowerCase().includes('too many')
      if (isLocked) {
        setLocked(true)
        setLockSeconds(15 * 60) // mirror server 15-min lockout
        setError('')
        return
      }
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= MAX_CLIENT_ATTEMPTS) {
        setLocked(true)
        setLockSeconds(15 * 60)
        setError('')
      } else {
        setError('Invalid email or password.')
      }
    } else if (result?.ok) {
      setAttempts(0)
      router.push('/admin')
      router.refresh()
    }
  }

  const remaining = MAX_CLIENT_ATTEMPTS - attempts
  const lockMins  = Math.floor(lockSeconds / 60)
  const lockSecs  = lockSeconds % 60

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-lg mb-4 ${locked ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200'}`}>
            {locked ? <ShieldOff size={20} className="text-white"/> : <Lock size={20} className="text-white"/>}
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            {locked ? 'Account Locked' : 'Welcome back'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {locked ? 'Too many failed attempts' : 'Sign in to your admin account'}
          </p>
        </div>

        {/* Lockout banner */}
        {locked && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="text-red-500 mt-0.5 flex-shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-red-800">Temporarily locked</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Too many failed sign-in attempts. Please wait before trying again.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all"
                      style={{ width: `${(lockSeconds / (15 * 60)) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono font-bold text-red-700 w-14 text-right">
                    {lockMins}:{lockSecs.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attempt warning */}
        {!locked && attempts > 0 && attempts < MAX_CLIENT_ATTEMPTS && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-100">
            <ShieldAlert size={16} className="text-amber-500 mt-0.5 flex-shrink-0"/>
            <p className="text-sm text-amber-800">
              Invalid email or password.{' '}
              <span className="font-semibold">{remaining} attempt{remaining !== 1 ? 's' : ''} remaining</span>{' '}
              before temporary lockout.
            </p>
          </div>
        )}

        {/* Generic error (first attempt) */}
        {!locked && error && attempts === 1 && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Non-auth errors */}
        {!locked && error && attempts === 0 && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
            <p className="text-sm text-emerald-700">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@arcpem.com" required disabled={locked}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"/>
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <span className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Forgot password?</span>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" required disabled={locked}
                className="w-full pl-10 pr-11 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"/>
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={locked}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading || locked}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 mt-2
                       bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                       disabled:from-slate-300 disabled:to-slate-400
                       text-white font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:shadow-none
                       transition-all active:scale-[0.98] text-sm">
            {loading ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Signing in…</>
            ) : locked ? (
              <>Locked · {lockMins}:{lockSecs.toString().padStart(2,'0')}</>
            ) : (
              <>Sign in <ArrowRight size={16}/></>
            )}
          </button>
        </form>

        {/* Security note */}
        <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <Lock size={12} className="text-slate-400 flex-shrink-0"/>
          <p className="text-xs text-slate-400">
            Secured with bcrypt hashing · Rate-limited · 8-hour sessions
          </p>
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100"/>
          <span className="text-xs text-slate-400 font-medium">New here?</span>
          <div className="flex-1 h-px bg-slate-100"/>
        </div>

        <Link href="/register"
          className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl border-2 border-slate-200
                     text-slate-700 font-semibold text-sm hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50
                     transition-all active:scale-[0.98]">
          Create a new account
        </Link>
      </div>
    </div>
  )
}
