'use client'

import { useEffect, useState } from 'react'
import { Info, Database, ShieldCheck, Users, Key, Building2 } from 'lucide-react'

interface Stats {
  totalUsers?: number
  totalClients?: number
  totalLicenses?: number
  totalApiKeys?: number
  activeLicenses?: number
  activeClients?: number
}

export default function SettingsPage() {
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [dashRes, usersRes] = await Promise.all([
          fetch('/api/dashboard-stats'),
          fetch('/api/users'),
        ])
        const dashData = await dashRes.json()
        const usersData = await usersRes.json()
        setStats({
          totalUsers: usersData.users?.length ?? 0,
          totalClients: dashData.totalClients ?? 0,
          totalLicenses: dashData.totalLicenses ?? 0,
          totalApiKeys: dashData.totalApiKeys ?? 0,
          activeLicenses: dashData.activeLicenses ?? 0,
          activeClients: dashData.activeClients ?? 0,
        })
      } catch {}
      setLoading(false)
    }
    fetchStats()
  }, [])

  return (
    <div className="space-y-5">

      {/* About */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <div className="p-6">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Info size={15} />
            </div>
            About
          </h2>
          <div className="text-sm divide-y divide-gray-50">
            {[
              { label: 'Application', value: 'ARC PEM Admin' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Framework', value: 'Next.js 14 (App Router)' },
              { label: 'Database', value: 'SQLite via Prisma' },
              { label: 'Authentication', value: 'NextAuth.js + bcrypt' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-800 bg-slate-50 px-3 py-1 rounded-lg border border-gray-100 text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Database Overview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
        <div className="p-6">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Database size={15} />
            </div>
            Database Overview
          </h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatTile icon={<Users size={19} />} label="Total Users" value={stats.totalUsers ?? 0}
                gradient="from-blue-50 to-indigo-100" border="border-blue-200/60" iconBg="bg-blue-600" />
              <StatTile icon={<Building2 size={19} />} label="Total Clients" value={stats.totalClients ?? 0}
                gradient="from-violet-50 to-purple-100" border="border-violet-200/60" iconBg="bg-violet-600" />
              <StatTile icon={<Building2 size={19} />} label="Active Clients" value={stats.activeClients ?? 0}
                gradient="from-emerald-50 to-teal-100" border="border-emerald-200/60" iconBg="bg-emerald-600" />
              <StatTile icon={<ShieldCheck size={19} />} label="Total Licenses" value={stats.totalLicenses ?? 0}
                gradient="from-teal-50 to-cyan-100" border="border-teal-200/60" iconBg="bg-teal-600" />
              <StatTile icon={<ShieldCheck size={19} />} label="Active Licenses" value={stats.activeLicenses ?? 0}
                gradient="from-sky-50 to-blue-100" border="border-sky-200/60" iconBg="bg-sky-600" />
              <StatTile icon={<Key size={19} />} label="Active API Keys" value={stats.totalApiKeys ?? 0}
                gradient="from-purple-50 to-violet-100" border="border-purple-200/60" iconBg="bg-purple-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon, label, value, gradient, border, iconBg }: {
  icon: React.ReactNode; label: string; value: number
  gradient: string; border: string; iconBg: string
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  )
}
