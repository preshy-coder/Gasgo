// Location picker.
// - With VITE_GOOGLE_MAPS_API_KEY set: a Google Map with a fixed centre pin. The customer drags the map
//   under the pin (like ride-hailing apps); we reverse-geocode the centre into a readable address.
//   The map is limited to the Juja area (see src/lib/serviceArea.ts).
// - Without a key: a simple fallback with "use my location" and quick picks for areas in Juja, so development works.
import { useEffect, useRef, useState } from 'react'
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Crosshair, MapPin, Search } from 'lucide-react'
import { getCurrentPosition, type LatLng } from '../lib/location'
import { JUJA_AREAS, SERVICE_BOUNDS } from '../lib/serviceArea'

interface Props {
  value: LatLng
  onChange: (pos: LatLng) => void
  onAddress: (formatted: string) => void
}

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export function MapPicker(props: Props) {
  return KEY ? (
    <APIProvider apiKey={KEY} region="KE">
      <GoogleMapPicker {...props} />
    </APIProvider>
  ) : (
    <FallbackPicker {...props} />
  )
}

function GoogleMapPicker({ value, onChange, onAddress }: Props) {
  const map = useMap()
  const geocoding = useMapsLibrary('geocoding')
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const [query, setQuery] = useState('')
  const [locError, setLocError] = useState('')

  useEffect(() => {
    if (geocoding) geocoder.current = new geocoding.Geocoder()
  }, [geocoding])

  // Reverse-geocode whenever the pin settles.
  useEffect(() => {
    const g = geocoder.current
    if (!g) return
    const t = setTimeout(() => {
      g.geocode({ location: value }).then(
        (r) => r.results[0] && onAddress(r.results[0].formatted_address),
        () => undefined,
      )
    }, 500)
    return () => clearTimeout(t)
  }, [value, onAddress, geocoding])

  const search = async () => {
    if (!geocoder.current || !query.trim()) return
    try {
      const r = await geocoder.current.geocode({ address: query, bounds: SERVICE_BOUNDS, componentRestrictions: { country: 'KE' } })
      const loc = r.results[0]?.geometry.location
      if (loc) {
        const pos = { lat: loc.lat(), lng: loc.lng() }
        map?.panTo(pos)
        onChange(pos)
      }
    } catch {
      setLocError('No place found with that name.')
    }
  }

  const locate = async () => {
    setLocError('')
    try {
      const pos = await getCurrentPosition()
      map?.panTo(pos)
      map?.setZoom(17)
      onChange(pos)
    } catch (e) {
      setLocError((e as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-white/50" />
          <input
            className="w-full rounded-xl border border-white/25 bg-white/10 py-2.5 pr-3 pl-9 text-sm text-white outline-none backdrop-blur-md placeholder:text-white/40 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/25"
            placeholder="Search in Juja: estate, road or building"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </form>
      <div className="relative h-72 overflow-hidden rounded-2xl border border-white/20 shadow-lg shadow-black/40">
        <Map
          defaultCenter={value}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI
          restriction={{ latLngBounds: SERVICE_BOUNDS, strictBounds: false }}
          minZoom={12}
          onCameraChanged={(e) => onChange(e.detail.center)}
        />
        <MapPin
          className="pointer-events-none absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-full fill-brand-600 text-white drop-shadow"
          aria-hidden
        />
        <button
          type="button"
          onClick={locate}
          className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md"
        >
          <Crosshair className="h-4 w-4" /> My location
        </button>
      </div>
      <p className="text-xs text-white/55">Move the map so the pin sits on your gate or door.</p>
      {locError && <p className="text-sm text-red-300">{locError}</p>}
    </div>
  )
}

function FallbackPicker({ value, onChange, onAddress }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-3">
      <div className="motion-item relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/40 text-center shadow-lg shadow-black/40 backdrop-blur-xl">
        {/* Map-like grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <span aria-hidden className="absolute h-24 w-24 rounded-full bg-brand-600/30 blur-2xl" />
        <MapPin className="relative h-10 w-10 fill-brand-600 text-white drop-shadow-[0_4px_10px_rgba(232,80,2,0.6)]" aria-hidden />
        <p className="relative mt-1 font-mono text-xs text-white/75">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
        <p className="relative mt-1 px-6 text-xs text-white/45">Map preview appears once a Google Maps key is added.</p>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/50 bg-brand-600/15 py-2.5 text-sm font-semibold text-brand-200 backdrop-blur-md transition-colors hover:bg-brand-600/25"
        onClick={async () => {
          setError('')
          setBusy(true)
          try {
            onChange(await getCurrentPosition())
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Crosshair className="h-4 w-4" /> {busy ? 'Finding you…' : 'Use my current location'}
      </button>
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Or pick an area in Juja</p>
        <div className="flex flex-wrap gap-2">
          {JUJA_AREAS.map((a) => (
            <button
              type="button"
              key={a.name}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm text-white backdrop-blur-md transition-colors hover:bg-white/20"
              onClick={() => {
                onChange({ lat: a.lat, lng: a.lng })
                onAddress(`${a.name}, Juja`)
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
