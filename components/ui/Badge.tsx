import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'status' | 'role' | 'plan' | 'default'
  value?: string
  className?: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  INACTIVE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SUSPENDED: 'bg-red-100 text-red-700 border-red-200',
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  USER: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function Badge({ children, variant = 'default', value, className }: BadgeProps) {
  let colorClass = 'bg-gray-100 text-gray-600 border-gray-200'

  if (variant === 'status' && value) {
    colorClass = statusColors[value] ?? colorClass
  } else if (variant === 'role' && value) {
    colorClass = roleColors[value] ?? colorClass
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        colorClass,
        className
      )}
    >
      {children}
    </span>
  )
}
