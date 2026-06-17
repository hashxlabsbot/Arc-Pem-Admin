'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/admin':               { title: 'Dashboard',     subtitle: "Welcome back — here's what's happening" },
  '/admin/users':         { title: 'Users',         subtitle: 'Manage subscriber accounts' },
  '/admin/analytics':     { title: 'Analytics',     subtitle: 'Traffic and engagement insights' },
  '/admin/subscriptions': { title: 'Subscriptions', subtitle: 'Plans and billing management' },
  '/admin/clients':       { title: 'Clients',       subtitle: 'Manage software clients' },
  '/admin/licenses':      { title: 'Licenses',      subtitle: 'Generate and manage license keys' },
  '/admin/api-keys':      { title: 'API Keys',      subtitle: 'Client API key management' },
  '/admin/alerts':        { title: 'Alerts',        subtitle: 'License expiry warnings' },
  '/admin/activity':      { title: 'Activity Log',  subtitle: 'Audit trail of admin actions' },
  '/admin/settings':      { title: 'Settings',      subtitle: 'System configuration' },
}

export function Header() {
  const pathname = usePathname()
  const info =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k) && k !== '/admin')?.[1] ??
    { title: 'Admin', subtitle: '' }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div>
        <h1 className="text-base font-bold text-gray-900 leading-tight">{info.title}</h1>
        {info.subtitle && <p className="text-xs text-gray-400 leading-tight">{info.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          ADMIN
        </div>
      </div>
    </header>
  )
}
