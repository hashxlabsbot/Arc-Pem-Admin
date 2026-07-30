import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import { isTeamRole } from '@/lib/rbac'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || !isTeamRole(session.user.role)) redirect('/login?error=unauthorized')

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={{ name: session.user.name, email: session.user.email }} role={session.user.role} />
      <div className="ml-64 flex flex-col min-h-screen">
        <Header role={session.user.role} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
