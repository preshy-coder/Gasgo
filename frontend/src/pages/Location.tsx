// Choose a saved delivery address or drop a new pin. Dark glass design.
import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, MapPin, Plus, Trash2 } from 'lucide-react'
import { errorMessage } from '../api'
import { MapPicker } from '../components/MapPicker'
import type { LatLng } from '../lib/location'
import { OUTSIDE_AREA_MESSAGE, SERVICE_AREA, isInServiceArea } from '../lib/serviceArea'
import { EdgeBlur, GLASS, GLASS_INPUT, GlassError, GlassPage, GlassSpinner } from '../components/glass'
import { Button } from '../components/ui'
import { useAddresses, useCreateAddress, useDeleteAddress } from '../hooks/queries'
import { useCart } from '../store/cart'

const LABELS = ['Home', 'Work', 'Other']

export default function Location() {
  const navigate = useNavigate()
  const next = (useLocation().state as { next?: string } | null)?.next ?? '/'
  const { addressId, setAddress } = useCart()
  const addresses = useAddresses()
  const create = useCreateAddress()
  const remove = useDeleteAddress()

  const [adding, setAdding] = useState(false)
  const [pos, setPos] = useState<LatLng>(SERVICE_AREA.center)
  const [formatted, setFormatted] = useState('')
  const [label, setLabel] = useState('Home')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const onAddress = useCallback((a: string) => setFormatted(a), [])

  const showForm = adding || (addresses.isSuccess && addresses.data.length === 0)

  const save = async () => {
    setError('')
    if (!isInServiceArea(pos)) return setError(OUTSIDE_AREA_MESSAGE)
    if (!formatted.trim()) {
      setError('Add a short description of the location, e.g. estate and road.')
      const field = document.getElementById('addr')
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field?.focus({ preventScroll: true })
      return
    }
    try {
      const a = await create.mutateAsync({
        label,
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
        formatted_address: formatted.trim(),
        landmark_notes: notes.trim(),
      })
      setAddress(a.id)
      navigate(next, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <GlassPage title={showForm ? 'Add delivery location' : 'Delivery location'} back nav={false}>
      {/* Extra bottom space when the form is open, so every field can scroll above the Save button */}
      <div className={`flex-1 space-y-4 p-4 ${showForm ? 'pb-44' : ''}`}>
        {addresses.isPending && <GlassSpinner />}
        {addresses.isError && <GlassError message={errorMessage(addresses.error)} onRetry={() => addresses.refetch()} />}

        {!showForm && addresses.data && (
          <>
            <p className="px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Saved locations</p>
            <ul className="space-y-2.5">
              {addresses.data.map((a) => {
                const selected = a.id === addressId
                return (
                  <li key={a.id} className={`${GLASS} flex items-center gap-3 p-3.5 ${selected ? 'border-brand-400/70 bg-white/15' : ''}`}>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => {
                        setAddress(a.id)
                        navigate(next, { replace: true })
                      }}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          selected ? 'border-brand-400/60 bg-brand-600/25 text-brand-200' : 'border-white/20 bg-white/10 text-brand-300'
                        }`}
                      >
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{a.label}</span>
                        <span className="block truncate text-sm text-white/70">{a.formatted_address}</span>
                        {a.landmark_notes && <span className="block truncate text-xs text-white/50">{a.landmark_notes}</span>}
                      </span>
                      {selected && (
                        <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                    <button
                      aria-label={`Delete ${a.label}`}
                      className="rounded-full p-2 text-white/45 transition-colors hover:bg-red-500/20 hover:text-red-300"
                      onClick={() => {
                        if (a.id === addressId) setAddress(null)
                        remove.mutate(a.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              onClick={() => setAdding(true)}
              className={`${GLASS} flex w-full items-center justify-center gap-2 border-dashed py-3.5 font-semibold transition-colors hover:bg-white/15`}
            >
              <Plus className="h-5 w-5 text-brand-300" /> Add a new location
            </button>
          </>
        )}

        {showForm && (
          <>
            <p className={`${GLASS} flex items-center gap-2 px-3.5 py-2.5 text-sm`}>
              <MapPin className="h-4 w-4 shrink-0 text-brand-300" />
              <span>
                Drop the pin where you want your gas delivered.
              </span>
            </p>
            <MapPicker value={pos} onChange={setPos} onAddress={onAddress} />
            {!isInServiceArea(pos) && <GlassError message={OUTSIDE_AREA_MESSAGE} />}

            <div className={`${GLASS} space-y-4 p-4`}>
              <div>
                <label className="mb-1.5 block px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase" htmlFor="addr">
                  Address
                </label>
                <input
                  id="addr"
                  className={GLASS_INPUT}
                  placeholder="e.g. Ngong Rd, Kilimani, near the stage"
                  value={formatted}
                  onChange={(e) => {
                    setFormatted(e.target.value)
                    setError('')
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase" htmlFor="notes">
                  Directions for the rider <span className="tracking-normal normal-case text-white/40">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  className={GLASS_INPUT}
                  placeholder="e.g. Green gate opposite Naivas, House 14"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div>
                <p className="mb-1.5 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Save as</p>
                <div className="flex gap-2">
                  {LABELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLabel(l)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        label === l
                          ? 'border-transparent bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30'
                          : 'border-white/25 bg-white/10 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <>
          <EdgeBlur side="bottom" />
          <div className="sticky bottom-0 z-30 space-y-2 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {/* Save errors show here, right above the button, so they're always in view */}
            {error && <GlassError message={error} />}
            <div className="flex gap-2">
              {addresses.data && addresses.data.length > 0 && (
                <button
                  onClick={() => setAdding(false)}
                  className="rounded-xl border border-white/25 bg-white/10 px-4 font-semibold text-white backdrop-blur-xl hover:bg-white/15"
                >
                  Cancel
                </button>
              )}
              <Button full loading={create.isPending} onClick={save} className="shadow-xl shadow-black/50">
                Save location
              </Button>
            </div>
          </div>
        </>
      )}
    </GlassPage>
  )
}
