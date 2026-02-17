export type LatLng = { lat: number; lng: number };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function getLatLngFromAny(v: any): LatLng | null {
  if (!v) return null;
  const lat = v.lat ?? v.latitude ?? v.gps_lat ?? v.gpsLat ?? null;
  const lng = v.lng ?? v.longitude ?? v.gps_lng ?? v.gpsLng ?? null;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Haversine distance in meters.
export function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
}

export function isArrived(args: { distanceM: number; accuracyM?: number | null; baseThresholdM?: number }) {
  const base = typeof args.baseThresholdM === "number" && Number.isFinite(args.baseThresholdM) ? args.baseThresholdM : 150;
  const accuracy = typeof args.accuracyM === "number" && Number.isFinite(args.accuracyM) ? Math.max(0, args.accuracyM) : 0;
  const threshold = Math.max(base, accuracy * 1.5);
  return args.distanceM <= threshold;
}

