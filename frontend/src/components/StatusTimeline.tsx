import { Check, Undo2, X } from 'lucide-react'
import type { Order, OrderStatus } from '../types'
import { STATUS_LABEL, formatTime } from '../lib/format'

const DELIVERY_STEPS: OrderStatus[] = ['placed', 'paid', 'accepted', 'out_for_delivery', 'delivered']
const PICKUP_STEPS: OrderStatus[] = ['placed', 'paid', 'accepted', 'ready_for_pickup', 'collected']

const STEP_LABEL: Partial<Record<OrderStatus, string>> = { placed: 'Order placed' }

const STEP_HINT: Partial<Record<OrderStatus, string>> = {
  paid: 'M-Pesa payment received',
  accepted: 'The dealer is preparing your gas',
  out_for_delivery: 'Your gas is on the way',
  ready_for_pickup: 'Go to the dealer to collect',
}

const FAILED: OrderStatus[] = ['payment_failed', 'rejected_by_dealer', 'cancelled', 'refunded']
const STOPPED: OrderStatus[] = ['payment_failed', 'rejected_by_dealer', 'cancelled']

/** Vertical progress tracker: placed → paid → accepted → out for delivery / ready → delivered / collected. */
export function StatusTimeline({ order, forDealer }: { order: Order; forDealer?: boolean }) {
  const steps = order.type === 'delivery' ? DELIVERY_STEPS : PICKUP_STEPS
  const failed = FAILED.includes(order.status)
  // For a refunded order, show what stopped it (rejected / cancelled) and then the refund.
  const stoppedBy = order.status === 'refunded' ? ([...order.status_history].reverse().find((h) => STOPPED.includes(h.status))?.status ?? null) : failed ? order.status : null
  const reachedAt = (s: OrderStatus) => [...order.status_history].reverse().find((h) => h.status === s)?.at
  const currentIndex = failed
    ? Math.max(...steps.map((s, i) => (reachedAt(s) ? i : -1)))
    : steps.indexOf(order.status)

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const done = i <= currentIndex
        const isCurrent = i === currentIndex && !failed
        const at = reachedAt(step)
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={`absolute top-7 left-[13px] h-[calc(100%-1.5rem)] w-0.5 ${i < currentIndex ? 'bg-brand-500' : 'bg-slate-200'}`}
                aria-hidden
              />
            )}
            <span
              className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-brand-600 bg-brand-button text-white' : 'border-2 border-slate-300 bg-white'
              } ${isCurrent && !['delivered', 'collected'].includes(step) ? 'ring-4 ring-brand-100' : ''}`}
            >
              {done && <Check className="h-4 w-4" />}
            </span>
            <div className="flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`font-medium ${done ? 'text-ink' : 'text-slate-400'}`}>{STEP_LABEL[step] ?? STATUS_LABEL[step]}</p>
                {at && <span className="text-xs text-slate-500">{formatTime(at)}</span>}
              </div>
              {isCurrent && STEP_HINT[step] && <p className="text-sm text-slate-500">{STEP_HINT[step]}</p>}
            </div>
          </li>
        )
      })}
      {stoppedBy && (
        <li className="mt-5 flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
            <X className="h-4 w-4" />
          </span>
          <div className="pt-0.5">
            <p className="font-medium text-red-700">
              {stoppedBy === 'cancelled' && order.cancellation_reason === 'dealer_timeout' ? 'Cancelled: dealer didn’t respond' : STATUS_LABEL[stoppedBy]}
            </p>
            {reachedAt(stoppedBy) && <p className="text-xs text-slate-500">{formatTime(reachedAt(stoppedBy)!)}</p>}
          </div>
        </li>
      )}
      {order.status === 'refunded' && (
        <li className="mt-4 flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <Undo2 className="h-4 w-4" />
          </span>
          <div className="pt-0.5">
            <p className="font-medium text-green-700">{forDealer ? 'Refund sent to the customer' : 'Refund sent to your M-Pesa'}</p>
            {reachedAt('refunded') && <p className="text-xs text-slate-500">{formatTime(reachedAt('refunded')!)}</p>}
          </div>
        </li>
      )}
    </ol>
  )
}
