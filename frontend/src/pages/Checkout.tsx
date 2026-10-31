// Order summary. Prices and fees always come from the backend quote, never calculated here.
import { useMemo, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { MapPin, Store } from 'lucide-react'
import { errorMessage } from '../api'
import { BottomBar, Button, Card, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useAddresses, useCreateOrder, useDealers, useProducts, useQuote } from '../hooks/queries'
import { formatKes, productName, productTypeLabel } from '../lib/format'
import { useCart } from '../store/cart'
import type { QuoteRequest } from '../types'

export default function Checkout() {
  const navigate = useNavigate()
  const { orderType, items, addressId, dealerId, clear } = useCart()
  const products = useProducts()
  const addresses = useAddresses()
  const dealers = useDealers()
  const create = useCreateOrder()
  // Set once the order is placed, so the empty-cart redirect below doesn't fire while we leave the page.
  const placed = useRef(false)

  const req: QuoteRequest | null = useMemo(
    () =>
      dealerId && items.length
        ? { type: orderType, dealer_id: dealerId, address_id: orderType === 'delivery' ? (addressId ?? undefined) : undefined, items }
        : null,
    [orderType, items, addressId, dealerId],
  )
  const quote = useQuote(req)

  if (!req) return placed.current ? null : <Navigate to="/" replace />

  const dealer = dealers.data?.find((d) => d.id === dealerId)
  const address = addresses.data?.find((a) => a.id === addressId)

  const placeOrder = async () => {
    try {
      const order = await create.mutateAsync(req)
      placed.current = true
      navigate(`/orders/${order.id}/pay`, { replace: true })
      clear()
    } catch {
      /* error shown below */
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Checkout" back />
      <div className="flex-1 space-y-3 p-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">Your order</h2>
          <ul className="divide-y divide-slate-100">
            {items.map((i) => {
              const p = products.data?.find((x) => x.id === i.product_id)
              if (!p) return null
              return (
                <li key={i.product_id} className="flex justify-between py-2">
                  <div>
                    <p className="font-medium">
                      {i.quantity} × {productName(p)}
                    </p>
                    <p className="text-xs text-slate-500">{productTypeLabel(p)}</p>
                  </div>
                  <span className="tabular-nums">{formatKes(p.price_kes * i.quantity)}</span>
                </li>
              )
            })}
          </ul>
          <Link to="/" className="mt-1 inline-block text-sm font-semibold text-brand-700">
            Edit items
          </Link>
        </Card>

        <Card>
          <div className="flex gap-3">
            {orderType === 'delivery' ? <MapPin className="h-5 w-5 text-brand-600" /> : <Store className="h-5 w-5 text-brand-600" />}
            <div className="min-w-0 flex-1">
              {orderType === 'delivery' ? (
                <>
                  <p className="text-xs text-slate-500">Deliver to</p>
                  <p className="font-medium">{address?.label}</p>
                  <p className="truncate text-sm text-slate-600">{address?.formatted_address}</p>
                  <p className="mt-2 text-xs text-slate-500">From {dealer?.name}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Pick up at</p>
                  <p className="font-medium">{dealer?.name}</p>
                  <p className="text-sm text-slate-600">{dealer?.address}</p>
                  <p className="mt-2 text-xs text-slate-500">Bring your empty cylinder if you're refilling.</p>
                </>
              )}
            </div>
            <Link to="/dealers" className="text-sm font-semibold text-brand-700">
              Change
            </Link>
          </div>
        </Card>

        <Card>
          {quote.isPending && <Spinner label="Calculating total…" />}
          {quote.isError && <ErrorBox message={errorMessage(quote.error)} />}
          {quote.data && (
            <dl className="space-y-1.5 text-sm">
              <Row label="Gas" value={formatKes(quote.data.subtotal_kes)} />
              {orderType === 'delivery' && <Row label="Delivery fee" value={formatKes(quote.data.delivery_fee_kes)} />}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatKes(quote.data.total_kes)}</dd>
              </div>
            </dl>
          )}
        </Card>

        {create.isError && <ErrorBox message={errorMessage(create.error)} />}
      </div>

      <BottomBar>
        <Button full className="mb-1" loading={create.isPending} disabled={!quote.data} onClick={placeOrder}>
          Place order{quote.data ? ` · ${formatKes(quote.data.total_kes)}` : ''}
        </Button>
      </BottomBar>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
