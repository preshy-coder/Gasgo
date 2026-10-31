export interface LatLng {
  lat: number
  lng: number
}

/** Asks the browser for the phone's GPS position. Needs HTTPS (or localhost). */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('We could not get your location. Check that location access is allowed.')),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  })
}
