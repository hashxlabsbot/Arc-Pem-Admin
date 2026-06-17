import { SubscriptionManager } from '@/components/admin/SubscriptionManager'
import { CreditCard } from 'lucide-react'

export default function SubscriptionsPage() {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0">
            <CreditCard size={16} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Subscription Plans</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage pricing plans available to your customers.</p>
          </div>
        </div>
        <div className="p-6">
          <SubscriptionManager />
        </div>
      </div>
    </div>
  )
}
