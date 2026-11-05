// M-Pesa STK Push flow:
// 1. Customer confirms their M-Pesa number → POST /orders/{id}/pay/
// 2. We show "check your phone" and poll GET /orders/{id}/ every 3 s (useOrder does the polling)
// 3. Status becomes "paid" → success; "payment_failed" → retry; nothing after 60 s → timeout screen
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Smartphone, XCircle } from 'lucide-react'
import { errorMessage, USE_MOCK } from '../api'
import { BottomBar, Button, Card, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useCancelOrder, useOrder, usePayOrder } from '../hooks/queries'
import { PAID_STATUSES, displayPhone, formatKes, normalizePhone } from '../lib/format'
import { useAuth } from '../store/auth'

const TIMEOUT_S = 60

export default function Payment() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const order = useOrder(id)
  const pay = usePayOrder()
  const cancel = useCancelOrder()

  const [phoneInput, setPhoneInput] = useState(user ? displayPhone(user.phone) : '')
  const [phoneError, setPhoneError] = useState('')
  const [waitingSince, setWaitingSince] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_S)

  const status = order.data?.status

  useEffect(() => {
    if (waitingSince === null) return
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, TIMEOUT_S - Math.floor((Date.now() - waitingSince) / 1000)))
    }, 500)
    return () => clearInterval(t)
  }, [waitingSince])

  // Payment confirmed → go to tracking after a short success moment.
  // Only orders that are paid and going ahead count. Rejected, cancelled or refunded orders were paid
  // once but must not show "Payment received" here.
  const paid = status !== undefined && PAID_STATUSES.includes(status)
  useEffect(() => {
    if (!paid) return
    const t = setTimeout(() => navigate(`/orders/${id}`, { replace: true }), 1800)
    return () => clearTimeout(t)
  }, [paid, id, navigate])

  if (order.isPending) return <Spinner />
  if (order.isError) return <ErrorBox message={errorMessage(order.error)} onRetry={() => order.refetch()} />
  // Nothing to pay for any more: show the order (and its refund message) instead.
  if (status === 'cancelled' || status === 'rejected_by_dealer' || status === 'refunded') return <Navigate to={`/orders/${id}`} replace />

  const o = order.data
  const failed = status === 'payment_failed'
  const waiting = waitingSince !== null && status === 'placed'
  const timedOut = waiting && secondsLeft === 0

  const startPayment = async () => {
    setPhoneError('')
    const phone = normalizePhone(phoneInput)
    if (!phone) return setPhoneError('Enter a valid M-Pesa number, e.g. 0712 345 678.')
    try {
      await pay.mutateAsync({ id, phone })
      setSecondsLeft(TIMEOUT_S)
      setWaitingSince(Date.now())
    } catch {
      /* shown below */
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Pay with M-Pesa" back={waiting ? undefined : `/orders/${id}`} />

      <div className="flex-1 space-y-4 p-4">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Order {o.order_number}</p>
            <p className="text-sm text-slate-600">{o.dealer.name}</p>
          </div>
          <p className="text-xl font-bold tabular-nums">{formatKes(o.total_kes)}</p>
        </Card>

        {paid && (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <h2 className="mt-3 text-xl font-bold">Payment received</h2>
            {o.mpesa_receipt && <p className="mt-1 text-sm text-slate-500">M-Pesa receipt {o.mpesa_receipt}</p>}
            <p className="mt-1 text-sm text-slate-500">Taking you to your order…</p>
          </div>
        )}

        {waiting && !timedOut && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-green-200" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-mpesa text-white">
                <Smartphone className="h-9 w-9" />
              </span>
            </div>
            <h2 className="mt-6 text-xl font-bold">Check your phone</h2>
            <p className="mt-1 max-w-xs text-slate-600">
              Enter your M-Pesa PIN in the prompt sent to <b>{phoneInput}</b> to pay {formatKes(o.total_kes)}.
            </p>
            <p className="mt-4 text-sm text-slate-500">Waiting for confirmation… {secondsLeft}s</p>
          </div>
        )}

        {timedOut && (
          <Card className="text-center">
            <h2 className="text-lg font-bold">We haven't received the payment yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              If you entered your PIN, wait a moment, then check again. If no prompt appeared, send it again.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="secondary" onClick={() => order.refetch()} loading={order.isFetching}>
                I've paid, check again
              </Button>
              <Button variant="mpesa" onClick={startPayment} loading={pay.isPending}>
                Send prompt again
              </Button>
            </div>
          </Card>
        )}

        {failed && !waiting && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold">Payment didn't go through</p>
              <p className="text-sm">It may have been cancelled, timed out, or your balance was too low. You can try again.</p>
            </div>
          </div>
        )}

        {!paid && !waiting && (
          <div>
            <label className="text-sm font-medium" htmlFor="mpesa">
              M-Pesa number
            </label>
            <input
              id="mpesa"
              type="tel"
              inputMode="tel"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">You'll get a prompt on this phone to enter your M-Pesa PIN.</p>
            {USE_MOCK && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                Demo: payment succeeds after ~4 seconds. Use a number ending in 0000 to test a failed payment.
              </p>
            )}
            {phoneError && <p className="mt-2 text-sm text-red-600">{phoneError}</p>}
          </div>
        )}

        {pay.isError && <ErrorBox message={errorMessage(pay.error)} />}
        {cancel.isError && <ErrorBox message={errorMessage(cancel.error)} />}
      </div>

      {!paid && !waiting && (
        <BottomBar>
          <Button variant="mpesa" full loading={pay.isPending} onClick={startPayment}>
            {failed ? 'Try again' : 'Pay'} {formatKes(o.total_kes)}
          </Button>
          <Button
            variant="ghost"
            full
            className="mt-1 text-slate-600"
            loading={cancel.isPending}
            onClick={() => cancel.mutate(id, { onSuccess: () => navigate(`/orders/${id}`, { replace: true }) })}
          >
            Cancel order
          </Button>
        </BottomBar>
      )}
    </div>
  )
}
