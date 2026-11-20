// Dealer view of one order: accept / reject, then move it through the remaining steps.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Hourglass, Lock, MapPin, Navigation, Phone, Wallet } from 'lucide-react'
import { errorMessage } from '../../api'
import { StatusTimeline } from '../../components/StatusTimeline'
import { BottomBar, Button, Card, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui'
import { useDealerAccept, useDealerReject, useDealerSetStatus, useOrder } from '../../hooks/queries'
import { dealerPayout, displayPhone, formatKes, productName, productTypeLabel } from '../../lib/format'
import type { OrderStatus } from '../../types'

const REJECT_REASONS = ['Out of stock', 'Too far to deliver', 'Closing soon', 'Other']

export default function DealerOrderDetail() {
  const id = Number(useParams().id)
  const order = useOrder(id)
  const accept = useDealerAccept()
  const reject = useDealerReject()
  const setStatus = useDealerSetStatus()
  const [rejecting, setRejecting] = useState(false)

  if (order.isPending) return <Spinner />
  if (order.isError)
    return (
      <div className="p-4">
        <ErrorBox message={errorMessage(order.error)} onRetry={() => order.refetch()} />
      </div>
    )

  const o = order.data
  const error = accept.error ?? reject.error ?? setStatus.error

  let next: { status: OrderStatus; label: string } | null = null
  if (o.status === 'accepted') {
    next = o.type === 'delivery' ? { status: 'out_for_delivery', label: 'Send out for delivery' } : { status: 'ready_for_pickup', label: 'Mark ready for pickup' }
  } else if (o.status === 'out_for_delivery') next = { status: 'delivered', label: 'Mark as delivered' }
  else if (o.status === 'ready_for_pickup') next = { status: 'collected', label: 'Mark as collected' }
  // "Mark as delivered / collected" only works after the customer confirms receipt in their app.
  const handedOver = o.status === 'out_for_delivery' || o.status === 'ready_for_pickup'
  const confirmed = !!o.customer_confirmed_at
  const locked = handedOver && !confirmed

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={`Order ${o.order_number}`} back="/dealer" />
      <div className="flex-1 space-y-3 p-4">
        <Card>
          <div className="flex items-center justify-between">
            <StatusBadge status={o.status} />
            <span className="text-sm font-semibold">{o.type === 'delivery' ? 'Delivery' : 'Pickup'}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {o.items.map((i) => (
              <li key={i.product.id} className="flex justify-between">
                <span>
                  <span className="text-lg font-bold">{i.quantity}×</span> {productName(i.product)}
                  <span className="block text-xs text-slate-500">{productTypeLabel(i.product)}</span>
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Gas</dt>
              <dd className="tabular-nums">{formatKes(o.subtotal_kes)}</dd>
            </div>
            {o.type === 'delivery' && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Your delivery fee</dt>
                <dd className="tabular-nums">{formatKes(o.delivery_fee_kes)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
              <dt>You receive</dt>
              <dd className="tabular-nums">{formatKes(dealerPayout(o))}</dd>
            </div>
            {o.mpesa_receipt && <p className="text-xs text-slate-500">Customer paid with M-Pesa · {o.mpesa_receipt}</p>}
          </dl>
        </Card>

        <Card>
          <p className="text-xs text-slate-500">Customer</p>
          <div className="flex items-center justify-between">
            <p className="font-medium">{o.customer?.name}</p>
            {o.customer && (
              <a href={`tel:+${o.customer.phone}`} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                <Phone className="h-4 w-4" /> {displayPhone(o.customer.phone)}
              </a>
            )}
          </div>
          {o.type === 'delivery' && o.address && (
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <MapPin className="h-5 w-5 shrink-0 text-brand-600" />
              <div className="flex-1">
                <p className="text-sm">{o.address.formatted_address}</p>
                {o.address.landmark_notes && <p className="text-sm text-slate-500">{o.address.landmark_notes}</p>}
                <a
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${o.address.lat},${o.address.lng}`}
                >
                  <Navigation className="h-4 w-4" /> Navigate
                </a>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <StatusTimeline order={o} forDealer />
        </Card>

        {locked && (
          <div role="status" className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">{o.type === 'delivery' ? 'Waiting for the customer to confirm delivery' : 'Waiting for the customer to collect'}</p>
              <p className="mt-0.5">
                {o.type === 'delivery' ? 'Hand over the gas and ask the customer to tap “I’ve received my gas” in their app.' : 'When the customer collects, ask them to tap “I’ve collected my gas” in their app.'} The{' '}
                {formatKes(dealerPayout(o))} payment is released to you and “{next?.label}” unlocks once they confirm.
              </p>
            </div>
          </div>
        )}
        {confirmed && (
          <div role="status" className="flex gap-3 rounded-xl bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-200">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold">
                {handedOver ? 'The customer confirmed they received the gas' : o.status === 'delivered' ? 'Delivered: confirmed by the customer' : 'Collected: confirmed by the customer'}
              </p>
              <p className="mt-0.5">
                {formatKes(dealerPayout(o))} has been released to you.{handedOver && ` Tap “${next?.label}” to finish the order.`}
              </p>
            </div>
          </div>
        )}

        {o.cancellation_reason === 'dealer_timeout' && (o.status === 'cancelled' || o.status === 'refunded') && (
          <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">Cancelled: not accepted in time</p>
            <p className="mt-0.5">
              This order wasn’t accepted in time, so it was cancelled automatically and the customer {o.status === 'refunded' ? 'has been refunded' : 'is being refunded'}. Accept
              new orders quickly to keep them.
            </p>
          </div>
        )}
        {o.status === 'refunded' && o.cancellation_reason !== 'dealer_timeout' && (
          <div role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
            The customer has been refunded {formatKes(o.total_kes)} to their M-Pesa.
          </div>
        )}

        {rejecting && (
          <Card>
            <p className="mb-2 font-semibold">Why are you rejecting this order?</p>
            <p className="mb-3 text-sm text-slate-500">The customer will be refunded.</p>
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((r) => (
                <Button key={r} variant="danger" className="py-2 text-sm" loading={reject.isPending} onClick={() => reject.mutate({ id, reason: r }, { onSuccess: () => setRejecting(false) })}>
                  {r}
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="mt-2 text-slate-600" onClick={() => setRejecting(false)}>
              Keep order
            </Button>
          </Card>
        )}

        {error && <ErrorBox message={errorMessage(error)} />}
      </div>

      {(o.status === 'paid' || next) && !rejecting && (
        <BottomBar>
          <div className="mb-1 flex gap-2">
            {o.status === 'paid' && (
              <>
                <Button variant="danger" onClick={() => setRejecting(true)}>
                  Reject
                </Button>
                <Button full loading={accept.isPending} onClick={() => accept.mutate(id)}>
                  Accept order
                </Button>
              </>
            )}
            {next && (
              <Button full disabled={locked} loading={setStatus.isPending} onClick={() => setStatus.mutate({ id, status: next.status })}>
                {locked && <Lock className="h-4 w-4" />}
                {next.label}
              </Button>
            )}
          </div>
          {locked && <p className="pb-1 text-center text-xs text-slate-500">Unlocks when the customer confirms they received the gas.</p>}
        </BottomBar>
      )}
    </div>
  )
}
