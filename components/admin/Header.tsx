'use client'

import { usePathname } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/admin':               { title: 'Dashboard',     subtitle: "Welcome back — here's what's happening" },
  '/admin/users':         { title: 'Customers',     subtitle: 'arcpem.com accounts: firm owners and legacy desktop users' },
  '/admin/web-subscriptions': { title: 'Firms',     subtitle: 'ARC PEM subscriptions, trials, renewals and limits' },
  '/admin/payments':      { title: 'Payments',      subtitle: 'Subscription charges, bank transfers and GST invoices' },
  '/admin/demo-bookings': { title: 'Demo Bookings', subtitle: 'Free demos booked on arcpem.com' },
  '/admin/analytics':     { title: 'Analytics',     subtitle: 'Traffic and engagement insights' },
  '/admin/subscriptions': { title: 'Plans',         subtitle: 'Plans, prices and limits sold on arcpem.com' },
  '/admin/clients':       { title: 'Clients',       subtitle: 'Legacy desktop licence clients' },
  '/admin/licenses':      { title: 'Licenses',      subtitle: 'Generate and manage license keys' },
  '/admin/api-keys':      { title: 'API Keys',      subtitle: 'Client API key management' },
  '/admin/alerts':        { title: 'Alerts',        subtitle: 'License expiry warnings' },
  '/admin/activity':      { title: 'Activity Log',  subtitle: 'Audit trail of admin actions' },
  '/admin/settings':      { title: 'Settings',      subtitle: 'Billing rules, seller GST details and system' },
  '/admin/blog':          { title: 'Blog',          subtitle: 'Posts and CMS content' },
  '/admin/blog/analytics':{ title: 'Blog Analytics', subtitle: 'Views and reach per post' },
  '/admin/team':          { title: 'Team',          subtitle: 'Admin and blog editor accounts' },
}

export function Header({ role, onMenu }: { role?: string; onMenu?: () => void }) {
  const pathname = usePathname()
  const info =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([k]) => k !== '/admin')
      .sort((a, b) => b[0].length - a[0].length)
      .find(([k]) => pathname.startsWith(k))?.[1] ??
    { title: 'Admin', subtitle: '' }
  const badgeLabel = role === 'BLOG_EDITOR' ? 'BLOG EDITOR' : 'ADMIN'

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between gap-3 px-3 sm:px-6 sticky top-0 z-30 shadow-sm">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="lg:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-50 flex-shrink-0"
      >
        <Menu size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{info.title}</h1>
        {info.subtitle && <p className="hidden sm:block text-xs text-gray-400 leading-tight truncate">{info.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          {badgeLabel}
        </div>
      </div>
    </header>
  )
}
