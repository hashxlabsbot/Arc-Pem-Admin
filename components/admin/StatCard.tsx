import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: ReactNode
  iconBg: string
  accent?: string   // kept for call-site compat, unused
  suffix?: string
}

export function StatCard({ title, value, change, changeType = 'neutral', icon, iconBg, suffix }: StatCardProps) {
  const trendIcon =
    changeType === 'up'   ? <TrendingUp size={11} />   :
    changeType === 'down' ? <TrendingDown size={11} /> :
                            <Minus size={11} />
  const trendColor =
    changeType === 'up'   ? 'text-emerald-600' :
    changeType === 'down' ? 'text-red-500'     :
                            'text-gray-400'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0', iconBg)}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      {change && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
          {trendIcon}
          <span>{change}</span>
          {suffix && <span className="text-gray-400 font-normal">{suffix}</span>}
        </div>
      )}
    </div>
  )
}
