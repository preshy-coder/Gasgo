// Order summary. Prices and fees always come from the backend quote, never calculated here.
import { useMemo, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Cable, Flame, Gauge, Grid2x2, MapPin, Minus, Plus, Store } from 'lucide-react'
import { errorMessage } from '../api'
import { BottomBar, Button, Card, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useAddresses, useCreateOrder, useDealers, useProducts, useQuote } from '../hooks/queries'
import { HOSE_LENGTHS, accessoryInfo } from '../lib/catalog'
import { formatKes, productName, productTypeLabel } from '../lib/format'
import { useCart } from '../store/cart'
import type { AccessoryKind, AccessoryLine, DealerAccessory, QuoteRequest } from '../types'

export default function Checkout() {
  const navigate = useNavigate()
  const { orderType, items, addressId, dealerId, clear, accessories, setAccessory } = useCart()
  const products = useProducts()
  const addresses = useAddresses()
  const dealers = useDealers()
  const create = useCreateOrder()
  // Set once the order is placed, so the empty-cart redirect below doesn't fire while we leave the page.
  const placed = useRef(false)

  const dealer = dealers.data?.find((d) => d.id === dealerId)
  // Equipment this shop has in stock; only those cart lines are sent.
  const shopAccessories = useMemo(() => (dealer?.accessories ?? []).filter((a) => a.in_stock), [dealer])
  const chosen = useMemo(() => accessories.filter((l) => shopAccessories.some((a) => a.kind === l.kind)), [accessories, shopAccessories])

  const req: QuoteRequest | null = useMemo(
    () =>
      dealerId && items.length
        ? {
            type: orderType,
            dealer_id: dealerId,
            address_id: orderType === 'delivery' ? (addressId ?? undefined) : undefined,
            items,
            ...(chosen.length ? { accessories: chosen } : {}),
          }
        : null,
    [orderType, items, addressId, dealerId, chosen],
  )
  const quote = useQuote(req)

  if (!req) return placed.current ? null : <Navigate to="/" replace />

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
                  <span className="tabular-nums">
                    {formatKes((dealer?.stock.find((st) => st.product_id === p.id)?.price_kes ?? p.price_kes) * i.quantity)}
                  </span>
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

        {shopAccessories.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-slate-500">Add gas equipment</h2>
            <p className="text-xs text-slate-500">From {dealer?.name}, delivered with your gas.</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {shopAccessories.map((a) => (
                <AccessoryRow key={a.kind} item={a} line={chosen.find((l) => l.kind === a.kind)} onChange={setAccessory} />
              ))}
            </ul>
          </Card>
        )}

        <Card>
          {quote.isPending && <Spinner label="Calculating total…" />}
          {quote.isError && <ErrorBox message={errorMessage(quote.error)} />}
          {quote.data && (
            <dl className="space-y-1.5 text-sm">
              <Row label="Gas" value={formatKes(quote.data.subtotal_kes)} />
              {quote.data.accessories_kes > 0 && <Row label="Equipment" value={formatKes(quote.data.accessories_kes)} />}
              {orderType === 'delivery' && (
                <Row label="Delivery fee" value={quote.data.delivery_fee_kes === 0 ? 'Free' : formatKes(quote.data.delivery_fee_kes)} />
              )}
              <Row label="Service fee" value={formatKes(quote.data.service_fee_kes)} />
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

const ACCESSORY_ICONS: Record<AccessoryKind, React.ReactNode> = {
  regulator: <Gauge className="h-5 w-5" />,
  hose: <Cable className="h-5 w-5" />,
  lighter: <Flame className="h-5 w-5" />,
  grill: <Grid2x2 className="h-5 w-5" />,
}

function AccessoryRow({
  item,
  line,
  onChange,
}: {
  item: DealerAccessory
  line?: AccessoryLine
  onChange: (kind: AccessoryKind, quantity: number, length_m?: number) => void
}) {
  const info = accessoryInfo(item.kind)
  const qty = line?.quantity ?? 0
  const length = line?.length_m ?? 1.5
  const unit = info.perMetre ? Math.round(item.price_kes * length) : item.price_kes
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{ACCESSORY_ICONS[item.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{info.name}</p>
          <p className="text-xs text-slate-500">
            {info.perMetre ? `${formatKes(item.price_kes)} per metre${qty ? ` · ${length} m = ${formatKes(unit)}` : ''}` : formatKes(item.price_kes)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label={`Remove one ${info.name.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30"
            disabled={qty <= 0}
            onClick={() => onChange(item.kind, qty - 1)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
          <button
            aria-label={`Add a ${info.name.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 bg-brand-button text-white disabled:opacity-30"
            disabled={qty >= 5}
            onClick={() => onChange(item.kind, qty + 1, info.perMetre ? length : undefined)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {info.perMetre && qty > 0 && (
        <div className="mt-2 pl-[52px]">
          <p className="mb-1 text-xs text-slate-500">Length of each hose</p>
          <div className="flex flex-wrap gap-1.5">
            {HOSE_LENGTHS.map((m) => (
              <button
                key={m}
                aria-pressed={length === m}
                onClick={() => onChange(item.kind, qty, m)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  length === m ? 'border-transparent bg-brand-600 bg-brand-button text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                {m} m
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
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
