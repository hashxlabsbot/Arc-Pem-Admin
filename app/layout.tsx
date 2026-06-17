import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARC PEM Admin',
  description: 'Admin dashboard for ARC PEM — Construction Project Expense Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50">{children}</body>
    </html>
  )
}
