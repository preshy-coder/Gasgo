// Vendor stock: the shop enters its own gas types (brand, size, refill/new), prices and stock levels.
// Customers only see gas types that a shop has in stock, at that shop's price.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bike, Minus, PackagePlus, Plus, Store, Trash2, X } from 'lucide-react'
import { errorMessage } from '../../api'
import { CylinderIcon } from '../../components/CylinderIcon'
import { DealerShell } from '../../components/DealerShell'
import { GLASS, GLASS_INPUT, GlassEmpty, GlassError, GlassSpinner } from '../../components/glass'
import { Button } from '../../components/ui'
import { useAddStock, useMyShop, useMyStock, useProducts, useRemoveStock, useSetShopOpen, useUpdateShop, useUpdateStock } from '../../hooks/queries'
import { formatKes } from '../../lib/format'
import type { ProductType, StockItem } from '../../types'

/** At or below this many cylinders, an item is flagged "Low". */
const LOW_STOCK = 3
const SIZES = [3, 6, 13, 22, 50]

export default function DealerStock() {
  const isNewShop = useSearchParams()[0].get('new') === '1'
  const shop = useMyShop()
  const stock = useMyStock()
  const setOpen = useSetShopOpen()
  const [adding, setAdding] = useState(false)

  const items = useMemo(() => stock.data ?? [], [stock.data])
  const groups = useMemo(() => {
    const byBrand = new Map<string, StockItem[]>()
    for (const it of items) byBrand.set(it.product.brand, [...(byBrand.get(it.product.brand) ?? []), it])
    return [...byBrand.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, list]) => [brand, list.sort((x, y) => x.product.size_kg - y.product.size_kg || x.product.type.localeCompare(y.product.type))] as const)
  }, [items])

  const totalCylinders = items.reduce((n, it) => n + it.quantity, 0)
  const low = items.filter((it) => it.quantity > 0 && it.quantity <= LOW_STOCK).length
  const out = items.filter((it) => it.quantity === 0).length

  return (
    <DealerShell>
      <div className="flex-1 space-y-4 p-4">
        {isNewShop && items.length === 0 && (
          <div className={`${GLASS} relative overflow-hidden p-4`}>
            <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
            <p className="font-semibold">Your shop is registered 🎉</p>
            <p className="mt-1 text-sm text-white/70">Add the gas types you sell, with prices and how many you have. Customers can order as soon as you have stock.</p>
          </div>
        )}

        {/* Open / closed */}
        {shop.data && (
          <div className={`${GLASS} flex items-center gap-3 p-4`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${shop.data.is_open ? 'border-green-400/40 bg-green-500/15 text-green-300' : 'border-white/20 bg-white/10 text-white/50'}`}>
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{shop.data.is_open ? 'Shop is open' : 'Shop is closed'}</p>
              <p className="text-xs text-white/60">{shop.data.is_open ? 'Customers can order from you.' : 'Customers can’t order until you open.'}</p>
            </div>
            <button
              role="switch"
              aria-checked={shop.data.is_open}
              aria-label="Shop open"
              disabled={setOpen.isPending}
              onClick={() => setOpen.mutate(!shop.data.is_open)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${shop.data.is_open ? 'border-transparent bg-green-500' : 'border-white/25 bg-white/15'}`}
            >
              <span className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${shop.data.is_open ? 'left-[23px]' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        {/* Delivery fee: the shop's own charge, separate from gas prices */}
        {shop.data && <DeliveryFeeCard key={shop.data.id} fee={shop.data.delivery_fee_kes} />}

        {/* Summary */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Stat value={items.length} label="Gas types" />
            <Stat value={totalCylinders} label="Cylinders" />
            <Stat value={low + out} label="Low / out" tone={low + out > 0 ? 'warn' : undefined} />
          </div>
        )}

        {adding ? (
          <AddGasForm onClose={() => setAdding(false)} ownBrands={groups.map(([b]) => b)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={`${GLASS} flex w-full items-center justify-center gap-2 border-dashed py-3.5 font-semibold transition-colors hover:bg-white/15`}
          >
            <Plus className="h-5 w-5 text-brand-300" /> Add a gas type
          </button>
        )}

        {stock.isPending && <GlassSpinner />}
        {stock.isError && <GlassError message={errorMessage(stock.error)} onRetry={() => stock.refetch()} />}
        {stock.isSuccess && items.length === 0 && !adding && (
          <GlassEmpty
            icon={<PackagePlus className="h-6 w-6" />}
            title="No gas listed yet"
            text="Add each brand and size you sell, e.g. K-Gas 6 kg refill."
          />
        )}

        {groups.map(([brand, list]) => (
          <section key={brand} className={`${GLASS} p-4`}>
            <h2 className="mb-2 flex items-center justify-between">
              <span className="text-lg font-semibold">{brand}</span>
              <span className="text-xs text-white/50">
                {list.length} type{list.length > 1 ? 's' : ''}
              </span>
            </h2>
            <ul className="divide-y divide-white/10">
              {list.map((it) => (
                <StockRow key={it.id} item={it} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DealerShell>
  )
}

function DeliveryFeeCard({ fee }: { fee: number }) {
  const update = useUpdateShop()
  const [value, setValue] = useState(String(fee))
  const [saved, setSaved] = useState(false)
  const save = () => {
    if (value === '' || Number(value) === fee) return setValue(String(fee))
    update.mutate({ delivery_fee_kes: Number(value) }, { onSuccess: () => setSaved(true) })
  }
  return (
    <div className={`${GLASS} p-4`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-brand-300">
          <Bike className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Delivery fee</p>
          <p className="text-xs text-white/60">{fee === 0 ? 'You deliver for free.' : 'Charged on every delivery order.'}</p>
        </div>
        <label className="flex w-28 shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 focus-within:border-brand-400">
          <span className="text-xs text-white/50">KES</span>
          <input
            aria-label="Delivery fee in KES"
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent font-semibold text-white tabular-nums outline-none"
            value={value}
            onChange={(e) => {
              setSaved(false)
              setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 4))
            }}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
        </label>
      </div>
      <p className="mt-2.5 text-xs text-white/50">
        Customers pay your gas prices plus this fee for delivery (nothing for pickup). Gasgo’s service fee is added on top for the customer and doesn’t come out of
        your money.
      </p>
      {saved && !update.isPending && <p className="mt-1.5 text-xs font-medium text-green-300">Saved. New delivery orders use {formatKes(Number(value))}.</p>}
      {update.isError && <p className="mt-1.5 text-xs text-red-300">{errorMessage(update.error)}</p>}
    </div>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'warn' }) {
  return (
    <div className={`${GLASS} px-3 py-2.5 text-center ${tone === 'warn' ? 'border-amber-300/40' : ''}`}>
      <p className={`text-xl font-bold tabular-nums ${tone === 'warn' ? 'text-amber-300' : ''}`}>{value}</p>
      <p className="text-[11px] text-white/60">{label}</p>
    </div>
  )
}

function Level({ qty }: { qty: number }) {
  if (qty === 0) return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">Out of stock</span>
  if (qty <= LOW_STOCK) return <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Low</span>
  return <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold text-green-300">In stock</span>
}

function StockRow({ item }: { item: StockItem }) {
  const update = useUpdateStock()
  const remove = useRemoveStock()
  const [price, setPrice] = useState(String(item.price_kes))
  const [confirm, setConfirm] = useState(false)
  const p = item.product

  const savePrice = () => {
    const n = Number(price)
    if (!Number.isFinite(n) || n <= 0) return setPrice(String(item.price_kes))
    if (n !== item.price_kes) update.mutate({ id: item.id, price_kes: Math.round(n) })
  }

  return (
    <li className="py-3 first:pt-1 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-white/85">
          <CylinderIcon sizeKg={p.size_kg} className="h-10 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {p.size_kg} kg · {p.type === 'refill' ? 'Refill' : 'New cylinder'}
          </p>
          <div className="mt-0.5">
            <Level qty={item.quantity} />
          </div>
        </div>
        {confirm ? (
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg bg-red-500/80 px-2.5 py-1 text-xs font-semibold text-white"
              onClick={() => remove.mutate(item.id)}
              disabled={remove.isPending}
            >
              Remove
            </button>
            <button aria-label="Keep" className="rounded-full p-1.5 text-white/60 hover:bg-white/10" onClick={() => setConfirm(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            aria-label={`Remove ${p.brand} ${p.size_kg}kg`}
            className="rounded-full p-2 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-300"
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-3 pl-[52px]">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 focus-within:border-brand-400">
          <span className="text-xs text-white/50">KES</span>
          <input
            aria-label="Price in KES"
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent font-semibold text-white tabular-nums outline-none"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={savePrice}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
        </label>
        <div className="flex items-center gap-1" aria-label="Quantity in stock">
          <button
            aria-label="One less in stock"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 disabled:opacity-30"
            disabled={item.quantity <= 0}
            onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
          <button
            aria-label="One more in stock"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30"
            onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {update.isError && <p className="mt-1.5 pl-[52px] text-xs text-red-300">{errorMessage(update.error)}</p>}
    </li>
  )
}

function AddGasForm({ onClose, ownBrands }: { onClose: () => void; ownBrands: string[] }) {
  const add = useAddStock()
  const catalogue = useProducts()
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState<number | null>(null)
  const [customSize, setCustomSize] = useState('')
  const [type, setType] = useState<ProductType>('refill')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  // Brand suggestions: brands other shops already list, plus your own.
  const suggestions = useMemo(
    () => [...new Set([...(catalogue.data?.map((p) => p.brand) ?? []), ...ownBrands])].sort(),
    [catalogue.data, ownBrands],
  )

  const sizeKg = size ?? Number(customSize)

  const save = async () => {
    setError('')
    if (brand.trim().length < 2) return setError('Type the gas brand, e.g. K-Gas or Pro Gas.')
    if (!(sizeKg > 0)) return setError('Choose the cylinder size.')
    if (!(Number(price) > 0)) return setError('Enter your price in KES.')
    if (qty === '' || Number(qty) < 0) return setError('Enter how many cylinders you have (0 if none right now).')
    try {
      await add.mutateAsync({ brand: brand.trim(), size_kg: sizeKg, type, price_kes: Number(price), quantity: Number(qty) })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-transparent bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30' : 'border-white/25 bg-white/10 text-white/80 hover:bg-white/15'
    }`
  const label = 'mb-1.5 block px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase'

  return (
    <form
      noValidate
      className={`${GLASS} relative space-y-4 overflow-hidden p-4`}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add a gas type</h2>
        <button type="button" aria-label="Close" className="rounded-full p-1.5 text-white/60 hover:bg-white/10" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div>
        <label className={label} htmlFor="brand">
          Brand
        </label>
        <input
          id="brand"
          list="gas-brands"
          autoFocus
          autoComplete="off"
          className={GLASS_INPUT}
          placeholder="e.g. K-Gas, Pro Gas, Total"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <datalist id="gas-brands">
          {suggestions.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((b) => (
              <button key={b} type="button" className={`${chip(brand === b)} px-3 py-1 text-xs`} onClick={() => setBrand(b)}>
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className={label}>Cylinder size</p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={chip(size === s)}
              onClick={() => {
                setSize(s)
                setCustomSize('')
              }}
            >
              {s} kg
            </button>
          ))}
          <input
            aria-label="Other size in kg"
            inputMode="numeric"
            className={`w-24 rounded-full border px-3.5 py-1.5 text-sm text-white outline-none placeholder:text-white/40 ${
              size === null && customSize ? 'border-brand-400 bg-white/15' : 'border-white/25 bg-white/10'
            }`}
            placeholder="Other kg"
            value={customSize}
            onChange={(e) => {
              setCustomSize(e.target.value.replace(/[^\d.]/g, ''))
              setSize(null)
            }}
          />
        </div>
      </div>

      <div>
        <p className={label}>Type</p>
        <div className="flex gap-2">
          <button type="button" className={chip(type === 'refill')} onClick={() => setType('refill')}>
            Refill
          </button>
          <button type="button" className={chip(type === 'new_cylinder')} onClick={() => setType('new_cylinder')}>
            New cylinder + gas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="price">
            Price (KES)
          </label>
          <input
            id="price"
            inputMode="numeric"
            className={GLASS_INPUT}
            placeholder="e.g. 1250"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
        <div>
          <label className={label} htmlFor="qty">
            In stock
          </label>
          <input
            id="qty"
            inputMode="numeric"
            className={GLASS_INPUT}
            placeholder="e.g. 10"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
      </div>

      {price && Number(price) > 0 && brand.trim() && sizeKg > 0 && (
        <p className="text-sm text-white/65">
          Customers will see: <b className="text-white">{brand.trim()} {sizeKg}kg {type === 'refill' ? 'refill' : 'new cylinder'}</b> at{' '}
          <b className="text-white">{formatKes(Number(price))}</b>
        </p>
      )}

      {error && <GlassError message={error} />}

      <Button type="submit" full loading={add.isPending}>
        Add to my stock
      </Button>
    </form>
  )
}
