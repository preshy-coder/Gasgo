// Pick a dealer. Delivery: sorted by distance from the delivery pin. Pickup: by distance from the phone's location.
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Clock, Navigation, Phone, Store } from 'lucide-react'
import { errorMessage } from '../api'
import { getCurrentPosition, type LatLng } from '../lib/location'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useAddresses, useDealers } from '../hooks/queries'
import { useCart } from '../store/cart'
import type { Dealer } from '../types'

export default function Dealers() {
  const navigate = useNavigate()
  const { orderType, items, addressId, dealerId, setDealer } = useCart()
  const addresses = useAddresses()
  const address = addresses.data?.find((a) => a.id === addressId)

  const [here, setHere] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(orderType === 'pickup')
  useEffect(() => {
    if (orderType !== 'pickup') return
    getCurrentPosition()
      .then(setHere)
      .catch(() => setHere(null))
      .finally(() => setLocating(false))
  }, [orderType])

  const origin = orderType === 'delivery' ? address : here
  const dealers = useDealers(origin?.lat, origin?.lng)

  if (items.length === 0) return <Navigate to="/" replace />
  if (orderType === 'delivery' && addresses.isSuccess && !address) return <Navigate to="/location" replace state={{ next: '/dealers' }} />

  const availability = (d: Dealer): { ok: boolean; reason?: string } => {
    if (!d.is_open) return { ok: false, reason: 'Closed now' }
    const missing = items.some((i) => (d.stock.find((s) => s.product_id === i.product_id)?.quantity ?? 0) < i.quantity)
    if (missing) return { ok: false, reason: 'Not enough stock for your order' }
    if (orderType === 'delivery' && d.distance_km !== undefined && d.distance_km > d.delivery_radius_km) {
      return { ok: false, reason: `Doesn't deliver this far (${d.delivery_radius_km} km max)` }
    }
    return { ok: true }
  }

  const sorted = [...(dealers.data ?? [])].sort((a, b) => Number(availability(b).ok) - Number(availability(a).ok))

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={orderType === 'delivery' ? 'Choose a dealer' : 'Choose a pickup point'} back />
      <div className="flex-1 space-y-3 p-4">
        {orderType === 'delivery' && address && (
          <p className="text-sm text-slate-600">
            Delivering to <span className="font-semibold text-ink">{address.label}</span> · {address.formatted_address}
          </p>
        )}
        {orderType === 'pickup' && !locating && !here && (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
            Turn on location to see the dealers closest to you.
          </p>
        )}

        {(locating || dealers.isPending) && <Spinner label="Finding dealers near you…" />}
        {dealers.isError && <ErrorBox message={errorMessage(dealers.error)} onRetry={() => dealers.refetch()} />}
        {dealers.isSuccess && dealers.data.length === 0 && (
          <EmptyState icon={<Store className="h-6 w-6" />} title="No dealers nearby yet" text="We're adding new dealers every week." />
        )}

        {!locating &&
          sorted.map((d) => {
            const a = availability(d)
            return (
              <div
                key={d.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${d.id === dealerId ? 'ring-2 ring-brand-500' : 'ring-slate-200'} ${
                  a.ok ? '' : 'opacity-60'
                }`}
              >
                <button
                  disabled={!a.ok}
                  className="w-full text-left disabled:cursor-not-allowed"
                  onClick={() => {
                    setDealer(d.id)
                    navigate('/checkout')
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{d.name}</p>
                    {d.distance_km !== undefined && <span className="shrink-0 text-sm font-medium text-slate-600">{d.distance_km} km</span>}
                  </div>
                  <p className="text-sm text-slate-600">{d.address}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> {d.opening_hours}
                  </p>
                  {a.ok ? (
                    <p className="mt-2 text-sm font-medium text-green-700">In stock · tap to continue</p>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-red-600">{a.reason}</p>
                  )}
                </button>
                {orderType === 'pickup' && (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 text-sm font-semibold text-brand-700">
                    <a
                      className="flex items-center gap-1"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
                    >
                      <Navigation className="h-4 w-4" /> Directions
                    </a>
                    <a className="ml-4 flex items-center gap-1" href={`tel:+${d.phone}`}>
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
