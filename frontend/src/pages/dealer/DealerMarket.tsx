// Vendor market: gas equipment the shop sells next to cylinders (regulators, hose pipes, lighters, grills).
// Items come from a fixed list; the vendor ticks the ones they have and enters their own price.
// Customers can add these to their order at checkout.
import { useState } from 'react'
import { Cable, Flame, Gauge, Grid2x2 } from 'lucide-react'
import { errorMessage } from '../../api'
import { DealerShell } from '../../components/DealerShell'
import { GLASS, GlassError, GlassSpinner } from '../../components/glass'
import { useMyShop, useRemoveAccessory, useSetAccessory } from '../../hooks/queries'
import { ACCESSORIES, type AccessoryInfo } from '../../lib/catalog'
import { formatKes } from '../../lib/format'
import type { AccessoryKind, DealerAccessory } from '../../types'

const ICONS: Record<AccessoryKind, React.ReactNode> = {
  regulator: <Gauge className="h-5 w-5" />,
  hose: <Cable className="h-5 w-5" />,
  lighter: <Flame className="h-5 w-5" />,
  grill: <Grid2x2 className="h-5 w-5" />,
}

export default function DealerMarket() {
  const shop = useMyShop()
  const selling = shop.data?.accessories ?? []

  return (
    <DealerShell>
      <div className="flex-1 space-y-3 p-4">
        <div className="px-1">
          <h2 className="font-semibold">Gas equipment</h2>
          <p className="text-sm text-white/65">
            Turn on the items you sell and set your price. Customers can add them to their order together with a cylinder.
          </p>
        </div>

        {shop.isPending && <GlassSpinner />}
        {shop.isError && <GlassError message={errorMessage(shop.error)} onRetry={() => shop.refetch()} />}
        {shop.isSuccess && (
          <>
            <p className="px-1 text-xs text-white/50">
              Selling {selling.length} of {ACCESSORIES.length} items
            </p>
            {ACCESSORIES.map((info) => (
              <AccessoryCard key={info.kind} info={info} listing={selling.find((a) => a.kind === info.kind)} />
            ))}
          </>
        )}
      </div>
    </DealerShell>
  )
}

function AccessoryCard({ info, listing }: { info: AccessoryInfo; listing?: DealerAccessory }) {
  const setItem = useSetAccessory()
  const remove = useRemoveAccessory()
  const [price, setPrice] = useState(listing ? String(listing.price_kes) : '')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const on = !!listing || editing
  const busy = setItem.isPending || remove.isPending

  const save = (inStock = listing?.in_stock ?? true) => {
    setError('')
    if (!(Number(price) > 0)) return setError(info.perMetre ? 'Enter your price per metre.' : 'Enter your price in KES.')
    setItem.mutate(
      { kind: info.kind, price_kes: Number(price), in_stock: inStock },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  const toggle = () => {
    if (listing) remove.mutate(info.kind, { onSuccess: () => setPrice('') })
    else setEditing(!editing)
  }

  return (
    <div className={`${GLASS} p-4 ${on ? '' : 'opacity-80'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            on ? 'border-brand-400/40 bg-brand-500/20 text-brand-200' : 'border-white/20 bg-white/10 text-white/60'
          }`}
        >
          {ICONS[info.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{info.name}</p>
          <p className="text-xs text-white/60">
            {listing
              ? `${formatKes(listing.price_kes)}${info.perMetre ? ' per metre' : ''} · ${listing.in_stock ? 'In stock' : 'Out of stock'}`
              : info.description}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={`I sell ${info.name.toLowerCase()}`}
          disabled={busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? 'border-transparent bg-green-500' : 'border-white/25 bg-white/15'}`}
        >
          <span className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${on ? 'left-[23px]' : 'left-0.5'}`} />
        </button>
      </div>

      {on && (
        <div className="mt-3 flex items-center gap-2 pl-14">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 focus-within:border-brand-400">
            <span className="text-xs text-white/50">KES</span>
            <input
              aria-label={`${info.name} price${info.perMetre ? ' per metre' : ''}`}
              inputMode="numeric"
              autoFocus={editing && !listing}
              className="w-full min-w-0 bg-transparent font-semibold text-white tabular-nums outline-none"
              placeholder={info.perMetre ? 'per metre' : 'price'}
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              onBlur={() => listing && Number(price) !== listing.price_kes && save()}
              onKeyDown={(e) => e.key === 'Enter' && (listing ? (e.currentTarget as HTMLInputElement).blur() : save())}
            />
            {info.perMetre && <span className="shrink-0 text-xs text-white/50">/ m</span>}
          </label>
          {listing ? (
            <button
              disabled={busy}
              onClick={() => save(!listing.in_stock)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                listing.in_stock ? 'border-green-400/40 bg-green-500/15 text-green-200' : 'border-white/25 bg-white/10 text-white/70'
              }`}
            >
              {listing.in_stock ? 'In stock' : 'Out of stock'}
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => save(true)}
              className="shrink-0 rounded-full bg-brand-600 bg-brand-button px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-black/30"
            >
              Add
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 pl-14 text-xs text-red-300">{error}</p>}
    </div>
  )
}
