import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    tokenVersion: number
    checkedAt: number
  }
}

export interface UserWithPlan {
  id: string
  name: string
  email: string
  role: string
  status: string
  planId: string | null
  plan: {
    id: string
    name: string
    price: number
    period: string
  } | null
  webSubscription?: { id: string; firmName: string; status: string; plan: { name: string } } | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface PlanWithCount {
  id: string
  name: string
  price: number
  period: string
  description: string
  features: string
  maxProjects: number
  maxUsers: number
  maxSiteUsers?: number
  isActive: boolean
  product: string
  tier: string | null
  createdAt: Date | string
  updatedAt: Date | string
  _count?: {
    users: number
    webSubscriptions?: number
  }
  userCount?: number
}

export interface AnalyticsData {
  totalUsers: number
  activeUsers: number
  newThisMonth: number
  conversionRate: number
  monthlyData: { month: string; count: number }[]
  planDistribution: { name: string; count: number }[]
}

export interface StatCardProps {
  title: string
  value: string | number
  change: string
  changeType: 'up' | 'down'
  icon: React.ReactNode
  color: string
}
