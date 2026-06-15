// Great-circle distance + a radius filter. Used to keep candidates inside the
// requested pull radius regardless of what a provider returns.
const EARTH_RADIUS_MILES = 3958.7613;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Haversine distance between two lat/lng points, in miles. */
export function haversineMiles(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when (lat,lng) is within radiusMiles of the center. Null coords fail. */
export function withinRadius(
  centerLat: number,
  centerLng: number,
  lat: number | null,
  lng: number | null,
  radiusMiles: number,
): boolean {
  if (lat === null || lng === null) return false;
  return haversineMiles(centerLat, centerLng, lat, lng) <= radiusMiles;
}
