// My orders: the customer's order history on dark glass.
import { Link } from 'react-router-dom'
import { Bike, ChevronRight, ClipboardList, Store } from 'lucide-react'
import { errorMessage } from '../api'
import { GLASS, GlassEmpty, GlassPage, GlassSpinner } from '../components/glass'
import { Button, ErrorBox, StatusBadge } from '../components/ui'
import { useOrders } from '../hooks/queries'
import { formatDateTime, formatKes, isActiveOrder, productName } from '../lib/format'
import type { Order } from '../types'

export default function Orders() {
  const orders = useOrders()
  const active = orders.data?.filter((o) => isActiveOrder(o.status)) ?? []
  const past = orders.data?.filter((o) => !isActiveOrder(o.status)) ?? []

  return (
    <GlassPage title="My orders">
      <div className="space-y-5 p-4">
        {orders.isPending && <GlassSpinner />}
        {orders.isError && <ErrorBox message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />}
        {orders.isSuccess && orders.data.length === 0 && (
          <GlassEmpty
            icon={<ClipboardList className="h-6 w-6" />}
            title="No orders yet"
            text="Your gas orders will show up here."
            action={
              <Link to="/">
                <Button>Order gas</Button>
              </Link>
            }
          />
        )}

        {active.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">In progress</h2>
            <div className="space-y-2.5">
              {active.map((o) => (
                <OrderRow key={o.id} order={o} live />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Past orders</h2>
            <div className="space-y-2.5">
              {past.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </div>
          </section>
        )}
      </div>
    </GlassPage>
  )
}

function OrderRow({ order: o, live }: { order: Order; live?: boolean }) {
  return (
    <Link
      to={`/orders/${o.id}`}
      className={`${GLASS} flex items-center gap-3 p-4 transition-colors hover:bg-white/15 ${live ? 'border-brand-400/50' : ''}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-brand-300">
        {o.type === 'delivery' ? <Bike className="h-5 w-5" /> : <Store className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{o.order_number}</p>
          <StatusBadge status={o.status} />
        </div>
        <p className="mt-0.5 truncate text-sm text-white/75">{o.items.map((i) => `${i.quantity}× ${productName(i.product)}`).join(', ')}</p>
        <p className="text-xs text-white/50">
          {formatDateTime(o.created_at)} · {o.type === 'delivery' ? 'Delivery' : 'Pickup'} · {formatKes(o.total_kes)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-white/50" />
    </Link>
  )
}
