// Customer home (first screen after login): smoked-glass cards over the cylinder photo.
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bike, ChevronRight, MapPin, PackagePlus, RefreshCw, Store } from 'lucide-react'
import { errorMessage } from '../api'
import logo from '../assets/logo.svg'
import { CylinderIcon } from '../components/CylinderIcon'
import { GLASS, GLASS_FLAT, GlassPage, GlassSpinner } from '../components/glass'
import { GlassSelect } from '../components/GlassSelect'
import { Button, ErrorBox, StatusBadge } from '../components/ui'
import { useAddresses, useOrders, useProducts } from '../hooks/queries'
import { formatKes, isActiveOrder, productName } from '../lib/format'
import { useAuth } from '../store/auth'
import { cartCount, useCart } from '../store/cart'
import type { ProductType } from '../types'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const { orderType, setOrderType, items, setQuantity, addressId } = useCart()
  const products = useProducts()
  const addresses = useAddresses()
  const orders = useOrders()
  const { brand, setBrand, purchaseType, setPurchaseType } = useCart()

  const address = addresses.data?.find((a) => a.id === addressId)
  const activeOrder = orders.data?.find((o) => isActiveOrder(o.status))
  const qty = (id: number) => items.find((i) => i.product_id === id)?.quantity ?? 0
  const count = cartCount(items)
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (products.data?.find((p) => p.id === i.product_id)?.price_kes ?? 0) * i.quantity, 0),
    [items, products.data],
  )
  const brands = useMemo(() => [...new Set(products.data?.map((p) => p.brand) ?? [])], [products.data])
  const visible = products.data?.filter((p) => p.brand === brand && p.type === purchaseType).sort((a, b) => a.size_kg - b.size_kg) ?? []
  const otherLines = items.filter((i) => !visible.some((p) => p.id === i.product_id)).reduce((n, i) => n + i.quantity, 0)

  const goNext = () => {
    if (orderType === 'delivery' && !address) navigate('/location', { state: { next: '/dealers' } })
    else navigate('/dealers')
  }

  return (
    <GlassPage>

      <div className="relative flex-1 space-y-4 px-4 pt-5 pb-6">
        {/* Greeting */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-11 w-11 rounded-full ring-2 ring-white/30" />
          <div>
            <p className="text-sm text-white/65">Hi {user?.name?.split(' ')[0] || 'there'} 👋</p>
            <h1 className="text-2xl font-bold tracking-tight">Need gas today?</h1>
          </div>
        </div>

        {activeOrder && (
          <Link to={`/orders/${activeOrder.id}`} className="block">
            <div className={`${GLASS} flex items-center gap-3 p-4`}>
              <span className="relative flex h-3 w-3" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500" />
              </span>
              <div className="flex-1">
                <p className="text-xs text-white/60">Current order {activeOrder.order_number}</p>
                <div className="mt-1">
                  <StatusBadge status={activeOrder.status} />
                </div>
              </div>
              <span className="text-sm font-semibold">Track</span>
              <ChevronRight className="h-5 w-5" />
            </div>
          </Link>
        )}

        <div className={`${GLASS} p-1.5`}>
          <div className="grid grid-cols-2 gap-1.5" role="tablist">
            <TypeTab active={orderType === 'delivery'} onClick={() => setOrderType('delivery')} icon={<Bike />} label="Delivery" sub="To your door" />
            <TypeTab active={orderType === 'pickup'} onClick={() => setOrderType('pickup')} icon={<Store />} label="Pickup" sub="Collect at a dealer" />
          </div>
        </div>

        {orderType === 'delivery' && (
          <button onClick={() => navigate('/location')} className={`${GLASS} flex w-full items-center gap-3 p-4 text-left hover:bg-white/15`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <MapPin className="h-5 w-5 text-brand-300" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60">Deliver to</p>
              <p className="truncate font-medium">{address ? `${address.label} · ${address.formatted_address}` : 'Set your location'}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/60" />
          </button>
        )}

        {/* No backdrop blur on this card: a blurred card stops the dropdown inside it from blurring what's behind. */}
        <section className={`${GLASS_FLAT} relative z-20 space-y-4 p-4`}>
          <h2 className="font-semibold">What gas do you use?</h2>
          <GlassSelect
            tone="dark"
            label="Gas brand"
            placeholder="Choose your gas brand"
            value={brand}
            onChange={setBrand}
            options={brands.map((b, i) => ({ value: b, label: b, icon: <BrandDot brand={b} index={i} /> }))}
          />
          <GlassSelect<ProductType>
            tone="dark"
            label="Refill or new purchase"
            value={purchaseType}
            onChange={setPurchaseType}
            options={[
              { value: 'refill', label: 'Refill', description: 'Swap your empty cylinder for a full one', icon: <RefreshCw className="h-5 w-5 text-brand-300" /> },
              { value: 'new_cylinder', label: 'New purchase', description: 'Buy a new cylinder filled with gas', icon: <PackagePlus className="h-5 w-5 text-brand-300" /> },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-1 font-semibold">{brand ? `${brand} · ${purchaseType === 'refill' ? 'Refill' : 'New purchase'}` : 'Choose a size'}</h2>
          <p className="mb-3 text-xs text-white/60">
            {purchaseType === 'refill'
              ? 'Hand over your empty cylinder of the same brand and size.'
              : 'Includes the cylinder and the gas. Grill and burner not included.'}
          </p>

          {products.isPending && <GlassSpinner />}
          {products.isError && <ErrorBox message={errorMessage(products.error)} onRetry={() => products.refetch()} />}
          {products.isSuccess && products.data.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4 text-center text-sm text-white/65 backdrop-blur-md">
              No shops have gas in stock right now. Please check again soon.
            </p>
          )}
          {products.isSuccess && products.data.length > 0 && brand && visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4 text-center text-sm text-white/65 backdrop-blur-md">
              No shop has {brand} {purchaseType === 'refill' ? 'refills' : 'new cylinders'} in stock right now. Try another brand or type.
            </p>
          )}
          {products.isSuccess && !brand && (
            <p className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4 text-center text-sm text-white/65 backdrop-blur-md">
              Choose your gas brand above to see sizes and prices.
            </p>
          )}
          <ul className="space-y-2.5">
            {visible.map((p) => (
              <li key={p.id} className={`${GLASS} flex items-center gap-3 p-3`}>
                <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/85">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-14 w-12 object-contain" />
                  ) : (
                    <CylinderIcon sizeKg={p.size_kg} className="h-14 w-12" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{productName(p)}</p>
                  <p className="text-sm text-white/70">from {formatKes(p.price_kes)}</p>
                </div>
                <GlassStepper value={qty(p.id)} onChange={(v) => setQuantity(p.id, v)} max={5} />
              </li>
            ))}
          </ul>
          {otherLines > 0 && (
            <p className="mt-3 text-xs text-white/60">
              + {otherLines} other item{otherLines > 1 ? 's' : ''} already in your order.
            </p>
          )}
        </section>
      </div>

      {count > 0 && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
          <Button full onClick={goNext} className="justify-between rounded-2xl shadow-xl shadow-black/50">
            <span className="rounded-lg bg-white/20 px-2 py-0.5 text-sm">{count}</span>
            <span>{orderType === 'delivery' && !address ? 'Set location' : 'Choose dealer'}</span>
            <span>from {formatKes(subtotal)}</span>
          </Button>
        </div>
      )}
    </GlassPage>
  )
}

function GlassStepper({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="Decrease"
        className="h-9 w-9 rounded-full border border-white/30 bg-white/10 text-lg font-semibold disabled:opacity-30"
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="w-7 text-center font-semibold tabular-nums">{value}</span>
      <button
        aria-label="Increase"
        className="h-9 w-9 rounded-full bg-brand-600 bg-brand-button text-lg font-semibold text-white shadow-md shadow-black/30 disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

function TypeTab({ active, onClick, icon, label, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl p-3 text-left transition-colors [&>svg]:h-6 [&>svg]:w-6 ${
        active ? 'border border-white/35 bg-white/20 text-white shadow-inner shadow-white/10' : 'border border-transparent text-white/60 hover:text-white'
      }`}
    >
      {icon}
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs opacity-80">{sub}</span>
      </span>
    </button>
  )
}

const BRAND_COLORS = ['bg-sky-600', 'bg-red-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-500', 'bg-rose-600', 'bg-teal-600']

function BrandDot({ brand, index }: { brand: string; index: number }) {
  const color = BRAND_COLORS[index % BRAND_COLORS.length]
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${color}`} aria-hidden>
      {brand.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
    </span>
  )
}
