import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminShell } from '@/components/admin/AdminShell'
import { isTeamRole } from '@/lib/rbac'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || !isTeamRole(session.user.role)) redirect('/login?error=unauthorized')

  return (
    <AdminShell user={{ name: session.user.name, email: session.user.email }} role={session.user.role}>
      {children}
    </AdminShell>
  )
}
