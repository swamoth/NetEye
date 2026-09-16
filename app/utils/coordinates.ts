/**
 * Geographic math for the browser. Mirrors server/geo.js — keep the two in sync.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_KM = 6371;

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b in degrees (0 = north, clockwise). */
export function bearing(a: LatLng, b: LatLng): number {
  const p1 = toRad(a.lat);
  const p2 = toRad(b.lat);
  const dl = toRad(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at fraction `f` (0..1) along the great circle from a to b. */
export function interpolate(a: LatLng, b: LatLng, f: number): LatLng {
  const p1 = toRad(a.lat), l1 = toRad(a.lng), p2 = toRad(b.lat), l2 = toRad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-9) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

/** Geographic midpoint of a set of points (vector mean, handles the antimeridian). */
export function centroid(points: LatLng[]): LatLng {
  if (!points.length) return { lat: 0, lng: 0 };
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    const lat = toRad(p.lat), lng = toRad(p.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  x /= points.length; y /= points.length; z /= points.length;
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

/** Normalise a longitude to [-180, 180). */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Nominal altitude (globe radii) for a globe.gl arc between `a` and `b`.
 *
 * globe.gl draws arcs as a cubic Bezier whose control points sit at 25 % / 75 % of the great
 * circle, 1.5 x the nominal altitude above the surface. That curve is a chord: the longer the
 * arc, the more its middle sags towards the centre of the globe, so a fixed or capped altitude
 * lets long arcs cut through the surface while the library's default auto-scale throws medium
 * arcs far out into space. This solves the Bezier midpoint for a target clearance instead:
 * short hops stay low (~0.03) and the clearance grows with distance up to ARC_CLEARANCE_MAX
 * for antipodal routes, so every arc rises above the surface along its whole length.
 */
export const ARC_CLEARANCE_MIN = 0.03;
export const ARC_CLEARANCE_MAX = 0.15;

/** Height above the surface at the middle of an arc spanning `centralAngle` radians. */
export function arcClearanceFor(centralAngle: number): number {
  const f = Math.min(1, Math.max(0, centralAngle / Math.PI));
  return ARC_CLEARANCE_MIN + (ARC_CLEARANCE_MAX - ARC_CLEARANCE_MIN) * f;
}

export function arcAltitudeFor(a: LatLng, b: LatLng): number {
  const theta = haversineKm(a, b) / EARTH_RADIUS_KM; // central angle in radians
  const clearance = arcClearanceFor(theta);
  // Bezier midpoint radius = (cos(theta/2) + 3 R cos(theta/4)) / 4 with R the control-point radius.
  const controlRadius = (4 * (1 + clearance) - Math.cos(theta / 2)) / (3 * Math.cos(theta / 4));
  return (controlRadius - 1) / 1.5;
}

/** Camera altitude (globe radii) that comfortably frames a span of `km`. */
export function altitudeForSpanKm(km: number): number {
  return Math.min(2.6, Math.max(0.9, 0.9 + (km / 20000) * 1.7));
}

/** Format a coordinate pair for display, e.g. 12.97°N 77.59°E */
export function formatLatLng(p: LatLng): string {
  const lat = `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(p.lng).toFixed(2)}°${p.lng >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lng}`;
}

/**
 * Ray-casting point-in-polygon for GeoJSON rings ([lng, lat] pairs). Used to find which
 * country an incident falls in (see hooks/useGeoData.ts).
 */
export function pointInRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  const x = point.lng, y = point.lat;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: LatLng, polygon: number[][][]): boolean {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(point, polygon[k])) return false; // hole
  return true;
}
