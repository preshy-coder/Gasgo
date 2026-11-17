// Vendor orders: incoming paid orders to accept, orders in progress, and completed ones.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, ChevronRight, Inbox, Store } from 'lucide-react'
import { errorMessage } from '../../api'
import { DealerShell } from '../../components/DealerShell'
import { GLASS, GlassEmpty, GlassError, GlassSpinner } from '../../components/glass'
import { StatusBadge } from '../../components/ui'
import { useDealerOrders } from '../../hooks/queries'
import { formatKes, formatTime, productName } from '../../lib/format'
import type { Order } from '../../types'

type Tab = 'new' | 'active' | 'done'

const TAB_FILTER: Record<Tab, (o: Order) => boolean> = {
  new: (o) => o.status === 'paid',
  active: (o) => ['accepted', 'out_for_delivery', 'ready_for_pickup'].includes(o.status),
  done: (o) => ['delivered', 'collected', 'rejected_by_dealer', 'cancelled', 'refunded'].includes(o.status),
}

export default function DealerOrders() {
  const orders = useDealerOrders()
  const [tab, setTab] = useState<Tab>('new')

  const count = (t: Tab) => orders.data?.filter(TAB_FILTER[t]).length ?? 0
  const list = orders.data?.filter(TAB_FILTER[tab]) ?? []

  return (
    <DealerShell>
      <div className="flex gap-2 px-4 pt-4">
        {(['new', 'active', 'done'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              tab === t ? 'border-transparent bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30' : 'border-white/20 bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            {t === 'new' ? 'New' : t === 'active' ? 'In progress' : 'Completed'}
            {t !== 'done' && count(t) > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${tab === t ? 'bg-white/25' : 'bg-white/15'}`}>{count(t)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2.5 p-4">
        {orders.isPending && <GlassSpinner />}
        {orders.isError && <GlassError message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />}
        {orders.isSuccess && list.length === 0 && (
          <GlassEmpty
            icon={<Inbox className="h-6 w-6" />}
            title={tab === 'new' ? 'No new orders' : tab === 'active' ? 'Nothing in progress' : 'No completed orders yet'}
            text={tab === 'new' ? 'Paid orders appear here. This list refreshes automatically.' : undefined}
          />
        )}
        {list.map((o) => (
          <Link key={o.id} to={`/dealer/orders/${o.id}`} className={`${GLASS} flex items-center gap-3 p-4 transition-colors hover:bg-white/15`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-brand-300">
              {o.type === 'delivery' ? <Bike className="h-5 w-5" /> : <Store className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{o.order_number}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="truncate text-sm text-white/75">{o.items.map((i) => `${i.quantity}× ${productName(i.product)}`).join(', ')}</p>
              <p className="text-xs text-white/50">
                {formatTime(o.created_at)} · {o.type === 'delivery' ? 'Delivery' : 'Pickup'} · {formatKes(o.subtotal_kes + o.delivery_fee_kes)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50" />
          </Link>
        ))}
      </div>
    </DealerShell>
  )
}
