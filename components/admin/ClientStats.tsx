'use client'
import { useEffect, useState } from 'react'
import { StatCard } from '@/components/admin/StatCard'
import { Building2, ShieldCheck, AlertTriangle, Key } from 'lucide-react'

interface DashboardStats {
  totalClients: number; activeClients: number
  totalLicenses: number; activeLicenses: number
  expiringSoon: number; totalApiKeys: number
}

export function ClientStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    fetch('/api/dashboard-stats').then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  if (!stats) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
          <div className="h-3 w-20 bg-gray-100 rounded mb-3"/>
          <div className="h-8 w-14 bg-gray-100 rounded"/>
        </div>
      ))}
    </div>
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Clients" value={stats.totalClients} change={`${stats.activeClients} active`} changeType="up" icon={<Building2 size={20}/>} iconBg="bg-blue-500" accent="border-blue-500"/>
      <StatCard title="Active Licenses" value={stats.activeLicenses} change={`of ${stats.totalLicenses} total`} changeType="up" icon={<ShieldCheck size={20}/>} iconBg="bg-emerald-500" accent="border-emerald-500"/>
      <StatCard title="Expiring Soon" value={stats.expiringSoon} change="within 30 days" changeType={stats.expiringSoon > 0 ? 'down' : 'neutral'} icon={<AlertTriangle size={20}/>} iconBg={stats.expiringSoon > 0 ? 'bg-amber-500' : 'bg-gray-400'} accent={stats.expiringSoon > 0 ? 'border-amber-500' : 'border-gray-300'}/>
      <StatCard title="API Keys" value={stats.totalApiKeys} change="active keys" changeType="neutral" icon={<Key size={20}/>} iconBg="bg-purple-500" accent="border-purple-500"/>
    </div>
  )
}
