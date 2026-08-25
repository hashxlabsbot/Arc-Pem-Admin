'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, Users, BarChart3, CreditCard, LogOut,
  Building2, ShieldCheck, Key, Bell, Activity, Settings, Wallet, FileText, TrendingUp, UserCog, Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  {
    label: 'Subscribers',
    items: [
      { href: '/admin',               label: 'Dashboard',     icon: LayoutDashboard, exact: true },
      { href: '/admin/users',         label: 'Users',         icon: Users },
      { href: '/admin/analytics',     label: 'Analytics',     icon: BarChart3 },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { href: '/admin/payments',      label: 'Payments',      icon: Wallet },
    ],
  },
  {
    label: 'Clients',
    items: [
      { href: '/admin/clients',       label: 'Clients',       icon: Building2 },
      { href: '/admin/licenses',      label: 'Licenses',      icon: ShieldCheck },
      { href: '/admin/api-keys',      label: 'API Keys',      icon: Key },
      { href: '/admin/demo-bookings', label: 'Demo Bookings', icon: Video },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/blog', label: 'Blog', icon: FileText },
      { href: '/admin/blog/analytics', label: 'Blog Analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/team',     label: 'Team',     icon: UserCog },
      { href: '/admin/alerts',   label: 'Alerts',   icon: Bell },
      { href: '/admin/activity', label: 'Activity', icon: Activity },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface SidebarProps { user: { name?: string | null; email?: string | null }; role?: string }

function NavItem({ href, label, icon: Icon, exact }: { href: string; label: string; icon: React.ElementType; exact?: boolean }) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border-l-2',
        isActive
          ? 'bg-blue-500/15 text-blue-400 border-blue-400 pl-[10px]'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent pl-[10px]'
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

export function Sidebar({ user, role }: SidebarProps) {
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'
  // BLOG_EDITOR only sees the Content section — everything else (customers,
  // billing, licenses, team, settings) is out of scope for that role.
  const visibleSections = role === 'BLOG_EDITOR'
    ? sections.filter((s) => s.label === 'Content')
    : sections

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
            <path d="M4 28 L18 6 L32 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M10 28 L18 14 L26 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.25)"/>
            <line x1="4" y1="28" x2="32" y2="28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">ARC PEM</p>
          <p className="text-slate-400 text-xs">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-5">
        {visibleSections.map(section => (
          <div key={section.label}>
            <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700/60">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-sm font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name ?? 'Admin'}</p>
            <p className="text-slate-400 text-xs truncate">{user.email ?? ''}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent pl-[10px] transition-all duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
