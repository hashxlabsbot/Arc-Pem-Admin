'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Users, FileText, TrendingUp, ExternalLink } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface SeriesPoint { date: string; views: number; uniques: number }
interface PostRow {
  slug: string; title: string; status: string
  totalViews: number; windowViews: number; windowReach: number; publishedAt: string | null
}
interface Analytics {
  totals: { views: number; reach: number; publishedPosts: number; avgViews: number }
  series: SeriesPoint[]
  posts: PostRow[]
  days: number
  slug: string | null
}

const RANGES = [7, 30, 90] as const
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://arcpem.com'

const TIP_STYLE: React.CSSProperties = {
  background: '#1e293b', border: 'none', borderRadius: 10, fontSize: 12,
  color: '#e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
}
const TIP_LABEL: React.CSSProperties = { color: '#94a3b8', fontWeight: 500, marginBottom: 4 }

const nf = (n: number) => n.toLocaleString('en-IN')
const shortDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

export default function BlogAnalytics() {
  const router = useRouter()
  const [days, setDays] = useState<number>(30)
  const [slug, setSlug] = useState<string>('')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const qs = new URLSearchParams({ days: String(days) })
    if (slug) qs.set('slug', slug)
    fetch(`/api/blog/analytics?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, slug])

  const totals = data?.totals
  const series = data?.series ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => router.push('/admin/blog')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={15} /> Back to posts
      </button>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" /> Blog Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Views &amp; reach across every published article.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Post filter */}
          <select value={slug} onChange={(e) => setSlug(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white max-w-[220px]">
            <option value="">All posts</option>
            {(data?.posts ?? []).map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
          </select>
          {/* Range toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)}
                className={`px-3 py-2 text-xs font-semibold transition ${days === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi icon={<Eye size={16} />} label="Total views" value={totals ? nf(totals.views) : '—'} tint="from-indigo-500 to-blue-500" />
        <Kpi icon={<Users size={16} />} label="Reach (unique)" value={totals ? nf(totals.reach) : '—'} tint="from-emerald-400 to-teal-500" />
        <Kpi icon={<FileText size={16} />} label="Published posts" value={totals ? nf(totals.publishedPosts) : '—'} tint="from-violet-500 to-purple-600" />
        <Kpi icon={<TrendingUp size={16} />} label="Avg views / post" value={totals ? nf(totals.avgViews) : '—'} tint="from-amber-400 to-orange-500" />
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900">Views over time</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {slug ? 'Selected post' : 'All posts'} · last {days} days
              </p>
            </div>
          </div>
          {loading ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : series.every((s) => s.views === 0) ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No views recorded in this window yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TIP_STYLE} labelStyle={TIP_LABEL} labelFormatter={(label) => shortDate(String(label))}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="views" name="Views" stroke="#6366f1" strokeWidth={2.5} fill="url(#viewsGrad)"
                  activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="uniques" name="Reach" stroke="#10b981" strokeWidth={2} fill="url(#reachGrad)"
                  activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Views</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Reach (unique)</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">All posts</h3>
          <p className="text-xs text-gray-400 mt-0.5">Ranked by all-time views · window columns reflect the {days}-day range</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3">Post</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">All-time views</th>
              <th className="px-5 py-3 text-right">{days}d views</th>
              <th className="px-5 py-3 text-right">{days}d reach</th>
              <th className="px-5 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : (data?.posts.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No posts yet.</td></tr>
            ) : (
              data!.posts.map((p) => (
                <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.title}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                      {p.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{nf(p.totalViews)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-600">{nf(p.windowViews)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-600">{nf(p.windowReach)}</td>
                  <td className="px-5 py-3 text-right">
                    {p.status === 'PUBLISHED' ? (
                      <a href={`${MARKETING_URL}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="View live">
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <Link href={`/admin/blog`} className="inline-flex p-1.5 rounded-lg text-gray-300" title="Draft">
                        <ExternalLink size={15} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${tint}`} />
      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-1.5">
          {icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  )
}
