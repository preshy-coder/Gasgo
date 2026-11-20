// Where Gasgo operates: anywhere in Kenya (the app runs on M-Pesa, Kenyan phone numbers and KES).
// How far a customer can be from a shop is decided by each dealer's own delivery radius.
// The backend should enforce the same rule; this copy only gives customers instant feedback.
import type { LatLng } from './location'

export const SERVICE_AREA = {
  name: 'Kenya',
  /** Where the map opens before the customer drops a pin (Nairobi CBD). */
  center: { lat: -1.2864, lng: 36.8172 } as LatLng,
}

/** Quick picks offered when no map is available (approximate town centres). */
export const QUICK_AREAS: (LatLng & { name: string })[] = [
  { name: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
  { name: 'Westlands', lat: -1.2676, lng: 36.8108 },
  { name: 'Kilimani', lat: -1.2921, lng: 36.7856 },
  { name: 'Thika', lat: -1.0333, lng: 37.0693 },
  { name: 'Ruiru', lat: -1.146, lng: 36.96 },
  { name: 'Nakuru', lat: -0.3031, lng: 36.08 },
  { name: 'Mombasa', lat: -4.0435, lng: 39.6682 },
  { name: 'Kisumu', lat: -0.0917, lng: 34.768 },
]

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Map viewport limits: roughly Kenya. */
export const SERVICE_BOUNDS = { north: 5.1, south: -4.9, east: 41.95, west: 33.9 }

export function isInServiceArea(p: LatLng): boolean {
  return p.lat <= SERVICE_BOUNDS.north && p.lat >= SERVICE_BOUNDS.south && p.lng <= SERVICE_BOUNDS.east && p.lng >= SERVICE_BOUNDS.west
}

export const OUTSIDE_AREA_MESSAGE = 'Gasgo is available in Kenya only. Move the pin to a location in Kenya.'
