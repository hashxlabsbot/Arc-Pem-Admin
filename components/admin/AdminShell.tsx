'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface AdminShellProps {
  user: { name?: string | null; email?: string | null }
  role?: string
  children: React.ReactNode
}

/** Sidebar is pinned from `lg` up; below that it becomes a slide-in drawer opened from the header. */
export function AdminShell({ user, role, children }: AdminShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={user} role={role} open={open} onClose={() => setOpen(false)} />
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="lg:ml-64 flex flex-col min-h-screen min-w-0">
        <Header role={role} onMenu={() => setOpen(true)} />
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
