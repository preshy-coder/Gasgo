// Dealer home: incoming paid orders to accept, orders in progress, and completed ones.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bike, ChevronRight, Inbox, LogOut, Store } from 'lucide-react'
import { errorMessage } from '../../api'
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui'
import { useDealerOrders } from '../../hooks/queries'
import { formatKes, formatTime, productName } from '../../lib/format'
import { useAuth } from '../../store/auth'
import type { Order } from '../../types'

type Tab = 'new' | 'active' | 'done'

const TAB_FILTER: Record<Tab, (o: Order) => boolean> = {
  new: (o) => o.status === 'paid',
  active: (o) => ['accepted', 'out_for_delivery', 'ready_for_pickup'].includes(o.status),
  done: (o) => ['delivered', 'collected', 'rejected_by_dealer', 'cancelled'].includes(o.status),
}

export default function DealerOrders() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useAuth((s) => s.logout)
  const orders = useDealerOrders()
  const [tab, setTab] = useState<Tab>('new')

  const count = (t: Tab) => orders.data?.filter(TAB_FILTER[t]).length ?? 0
  const list = orders.data?.filter(TAB_FILTER[tab]) ?? []

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Dealer orders"
        right={
          <button
            aria-label="Log out"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => {
              logout()
              qc.clear()
              navigate('/welcome', { replace: true })
            }}
          >
            <LogOut className="h-5 w-5" />
          </button>
        }
      />
      <div className="sticky top-[57px] z-10 grid grid-cols-3 border-b border-slate-200 bg-white">
        {(['new', 'active', 'done'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 py-2.5 text-sm font-semibold ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
          >
            {t === 'new' ? 'New' : t === 'active' ? 'In progress' : 'Completed'}
            {t !== 'done' && count(t) > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs ${t === 'new' ? 'bg-brand-600 text-white' : 'bg-slate-200'}`}>{count(t)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2.5 p-4">
        {orders.isPending && <Spinner />}
        {orders.isError && <ErrorBox message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />}
        {orders.isSuccess && list.length === 0 && (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title={tab === 'new' ? 'No new orders' : tab === 'active' ? 'Nothing in progress' : 'No completed orders yet'}
            text={tab === 'new' ? 'Paid orders appear here. This list refreshes automatically.' : undefined}
          />
        )}
        {list.map((o) => (
          <Link key={o.id} to={`/dealer/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
              {o.type === 'delivery' ? <Bike className="h-5 w-5" /> : <Store className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{o.order_number}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="truncate text-sm text-slate-600">{o.items.map((i) => `${i.quantity}× ${productName(i.product)}`).join(', ')}</p>
              <p className="text-xs text-slate-500">
                {formatTime(o.created_at)} · {o.type === 'delivery' ? 'Delivery' : 'Pickup'} · {formatKes(o.total_kes)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
