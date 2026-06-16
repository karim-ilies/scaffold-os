export async function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat:       coords.latitude,
        lng:       coords.longitude,
        precision: coords.accuracy,
      }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: true },
    )
  })
}

export function distanceMetres(lat1, lng1, lat2, lng2) {
  const R    = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos((lat1 * Math.PI) / 180)
             * Math.cos((lat2 * Math.PI) / 180)
             * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estSurChantier(position, chantierCoords, rayonMetres = 300) {
  if (!position || !chantierCoords?.lat || !chantierCoords?.lng) return false
  return distanceMetres(position.lat, position.lng, chantierCoords.lat, chantierCoords.lng) < rayonMetres
}

export function determinerStatutValidation(tracesGPS, chantierCoords) {
  if (!tracesGPS || tracesGPS.length === 0) return 'a_verifier'
  const dansZone = tracesGPS.some(t =>
    estSurChantier({ lat: t.lat, lng: t.lng }, chantierCoords)
  )
  return dansZone ? 'valide' : 'a_verifier'
}

export function demarrerTraceGPS(chantierId, pointageId, onTrace) {
  return setInterval(async () => {
    const pos = await getCurrentPosition()
    if (pos) {
      onTrace({ ...pos, timestamp: new Date(), type: 'trace_10min' })
    }
  }, 10 * 60 * 1000)
}
