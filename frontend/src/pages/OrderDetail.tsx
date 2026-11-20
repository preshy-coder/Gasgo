// Order tracking. useOrder polls every 3 s while the order is still moving.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, MapPin, PackageCheck, Phone, RotateCcw, Store } from 'lucide-react'
import { errorMessage } from '../api'
import { StatusTimeline } from '../components/StatusTimeline'
import { BottomBar, Button, Card, ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui'
import { useCancelOrder, useConfirmReceived, useOrder } from '../hooks/queries'
import { awaitingRefund, displayPhone, formatDateTime, formatKes, productName } from '../lib/format'
import { useCart } from '../store/cart'

export default function OrderDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const order = useOrder(id)
  const cancel = useCancelOrder()
  const confirm = useConfirmReceived()
  const cart = useCart()
  const [confirming, setConfirming] = useState(false)

  if (order.isPending) return <Spinner />
  if (order.isError)
    return (
      <div className="p-4">
        <ErrorBox message={errorMessage(order.error)} onRetry={() => order.refetch()} />
      </div>
    )

  const o = order.data
  const needsPayment = o.status === 'placed' || o.status === 'payment_failed'
  const canCancel = ['placed', 'paid', 'payment_failed'].includes(o.status)
  const finished = ['delivered', 'collected', 'cancelled', 'rejected_by_dealer', 'refunded'].includes(o.status)
  const timedOut = o.cancellation_reason === 'dealer_timeout'
  const refundPending = awaitingRefund(o)
  // Payment is held until the customer confirms they have the gas.
  const canConfirm = (o.status === 'out_for_delivery' || o.status === 'ready_for_pickup') && !o.customer_confirmed_at

  const reorder = () => {
    cart.clear()
    cart.setOrderType(o.type)
    o.items.forEach((i) => cart.setQuantity(i.product.id, i.quantity))
    navigate('/')
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={`Order ${o.order_number}`} back="/orders" />
      <div className="flex-1 space-y-3 p-4">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={o.status} />
            <span className="text-xs text-slate-500">{formatDateTime(o.created_at)}</span>
          </div>
          <StatusTimeline order={o} />
        </Card>

        {/* Dealer didn't accept in time: the system cancelled the order */}
        {timedOut && (o.status === 'cancelled' || o.status === 'refunded') && (
          <Notice tone="warn" icon={<Clock3 className="h-5 w-5" />} title="The dealer didn’t respond in time">
            {o.dealer.name} didn’t accept your order in time, so we cancelled it for you.
            {o.status === 'cancelled' && ` Your ${formatKes(o.total_kes)} refund is on its way to your M-Pesa.`} You can order again from another dealer.
          </Notice>
        )}
        {/* Rejected or cancelled after payment, refund not sent yet */}
        {refundPending && !timedOut && (
          <Notice tone="warn" icon={<Clock3 className="h-5 w-5" />} title="Refund on its way">
            {o.status === 'rejected_by_dealer' ? "The dealer couldn't fulfil this order. " : 'Your order was cancelled. '}
            Your refund of {formatKes(o.total_kes)} will be sent to your M-Pesa. Contact support if it hasn't arrived within 24 hours.
          </Notice>
        )}
        {/* Refund done */}
        {o.status === 'refunded' && (
          <Notice tone="success" icon={<CheckCircle2 className="h-5 w-5" />} title="Refund sent to your M-Pesa">
            {formatKes(o.total_kes)} has been returned to your M-Pesa
            {o.customer?.phone ? ` (${displayPhone(o.customer.phone)})` : ''}. Check your M-Pesa messages for the confirmation.
          </Notice>
        )}
        {o.status === 'ready_for_pickup' && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-200">
            Your gas is ready. Show order number <b>{o.order_number}</b> at {o.dealer.name}
            {o.items.some((i) => i.product.type === 'refill') && ' and bring your empty cylinder'}.
          </div>
        )}

        {/* Customer confirmed receipt: payment released to the dealer */}
        {o.customer_confirmed_at && (
          <Notice tone="success" icon={<CheckCircle2 className="h-5 w-5" />} title={o.type === 'delivery' ? 'Delivery confirmed' : 'Pickup confirmed'}>
            Thanks for confirming. Your payment has been released to {o.dealer.name}.
          </Notice>
        )}

        {/* Ask before releasing the money */}
        {canConfirm && confirming && (
          <Card>
            <p className="font-semibold">Have you received your gas?</p>
            <p className="mt-1 text-sm text-slate-600">
              Only confirm once you have the cylinder and it's the right gas. Your payment will then be released to {o.dealer.name}. This can't be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="whitespace-nowrap" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
              <Button full loading={confirm.isPending} onClick={() => confirm.mutate(o.id, { onSuccess: () => setConfirming(false) })}>
                Yes, I have it
              </Button>
            </div>
            <Link to="/help" className="mt-3 block text-center text-sm font-semibold text-brand-700">
              Problem with your order? Contact us
            </Link>
          </Card>
        )}

        <Card>
          <div className="flex gap-3">
            {o.type === 'delivery' ? <MapPin className="h-5 w-5 text-brand-600" /> : <Store className="h-5 w-5 text-brand-600" />}
            <div className="flex-1">
              <p className="text-xs text-slate-500">{o.type === 'delivery' ? 'Delivering to' : 'Pick up at'}</p>
              {o.type === 'delivery' && o.address ? (
                <>
                  <p className="font-medium">{o.address.label}</p>
                  <p className="text-sm text-slate-600">{o.address.formatted_address}</p>
                  {o.address.landmark_notes && <p className="text-xs text-slate-500">{o.address.landmark_notes}</p>}
                </>
              ) : (
                <>
                  <p className="font-medium">{o.dealer.name}</p>
                  <p className="text-sm text-slate-600">{o.dealer.address}</p>
                  <a
                    className="text-sm font-semibold text-brand-700"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${o.dealer.lat},${o.dealer.lng}`}
                  >
                    Get directions
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-sm">
              <span className="text-slate-500">Dealer: </span>
              {o.dealer.name}
            </p>
            <a href={`tel:+${o.dealer.phone}`} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
              <Phone className="h-4 w-4" /> Call
            </a>
          </div>
        </Card>

        <Card>
          <ul className="space-y-1 text-sm">
            {o.items.map((i) => (
              <li key={i.product.id} className="flex justify-between">
                <span>
                  {i.quantity} × {productName(i.product)}
                </span>
                <span className="tabular-nums">{formatKes(i.unit_price_kes * i.quantity)}</span>
              </li>
            ))}
            {o.type === 'delivery' && (
              <li className="flex justify-between text-slate-600">
                <span>Delivery fee</span>
                <span className="tabular-nums">{o.delivery_fee_kes === 0 ? 'Free' : formatKes(o.delivery_fee_kes)}</span>
              </li>
            )}
            {o.service_fee_kes > 0 && (
              <li className="flex justify-between text-slate-600">
                <span>Service fee</span>
                <span className="tabular-nums">{formatKes(o.service_fee_kes)}</span>
              </li>
            )}
            <li className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatKes(o.total_kes)}</span>
            </li>
          </ul>
          {o.mpesa_receipt && <p className="mt-2 text-xs text-slate-500">M-Pesa receipt: {o.mpesa_receipt}</p>}
        </Card>

        {cancel.isError && <ErrorBox message={errorMessage(cancel.error)} />}
        {confirm.isError && <ErrorBox message={errorMessage(confirm.error)} />}
      </div>

      {(needsPayment || canCancel || finished || (canConfirm && !confirming)) && (
        <BottomBar>
          <div className="mb-1 space-y-1">
            {canConfirm && !confirming && (
              <>
                <Button full onClick={() => setConfirming(true)}>
                  <PackageCheck className="h-5 w-5" /> {o.type === 'delivery' ? 'I’ve received my gas' : 'I’ve collected my gas'}
                </Button>
                <p className="pt-1 pb-0.5 text-center text-xs text-slate-500">Your payment is held safely until you confirm.</p>
              </>
            )}
            {needsPayment && (
              <Link to={`/orders/${o.id}/pay`} className="block">
                <Button variant="mpesa" full>
                  Pay {formatKes(o.total_kes)} with M-Pesa
                </Button>
              </Link>
            )}
            {canCancel && (
              <Button variant="ghost" full className="text-slate-600" loading={cancel.isPending} onClick={() => cancel.mutate(o.id)}>
                Cancel order
              </Button>
            )}
            {finished && (
              <Button variant="secondary" full onClick={reorder}>
                <RotateCcw className="h-4 w-4" /> Order again
              </Button>
            )}
          </div>
        </BottomBar>
      )}
    </div>
  )
}

function Notice({ tone, icon, title, children }: { tone: 'warn' | 'success'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const styles = tone === 'success' ? 'bg-green-50 text-green-900 ring-green-200 [&_svg]:text-green-600' : 'bg-amber-50 text-amber-900 ring-amber-200 [&_svg]:text-amber-600'
  return (
    <div role="status" className={`flex gap-3 rounded-xl p-3 text-sm ring-1 ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  )
}
