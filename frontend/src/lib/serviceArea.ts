// Where Gasgo operates. For now: Juja, Kiambu County.
// The backend should enforce the same rule; this copy only gives customers instant feedback.
// Coordinates are approximate.
import type { LatLng } from './location'

export const SERVICE_AREA = {
  name: 'Juja',
  county: 'Kiambu County',
  center: { lat: -1.1018, lng: 37.0144 } as LatLng,
  radiusKm: 10,
}

/** Neighbourhoods offered as quick picks when no map is available (approximate centres). */
export const JUJA_AREAS: (LatLng & { name: string })[] = [
  { name: 'Juja Town', lat: -1.1018, lng: 37.0144 },
  { name: 'JKUAT', lat: -1.0946, lng: 37.0128 },
  { name: 'Highpoint', lat: -1.1062, lng: 37.0203 },
  { name: 'Gachororo', lat: -1.0985, lng: 37.0281 },
  { name: 'Kalimoni', lat: -1.1238, lng: 37.0082 },
  { name: 'Witeithie', lat: -1.1158, lng: 37.0398 },
]

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function isInServiceArea(p: LatLng): boolean {
  return distanceKm(p, SERVICE_AREA.center) <= SERVICE_AREA.radiusKm
}

export const OUTSIDE_AREA_MESSAGE = `Gasgo currently delivers within ${SERVICE_AREA.name}, ${SERVICE_AREA.county} only. Move the pin to a location in ${SERVICE_AREA.name}.`

/** Map viewport limits: roughly Juja and its surroundings. */
export const SERVICE_BOUNDS = { north: -1.02, south: -1.19, east: 37.11, west: 36.92 }
