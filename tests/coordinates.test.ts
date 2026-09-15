import { describe, expect, it } from 'vitest';
import {
  ARC_CLEARANCE_MAX, ARC_CLEARANCE_MIN, altitudeForSpanKm, arcAltitudeFor, arcClearanceFor, bearing, centroid, EARTH_RADIUS_KM,
  haversineKm, interpolate, pointInPolygon, toRad, wrapLng, type LatLng,
} from '../app/utils/coordinates';

const NYC = { lat: 40.7128, lng: -74.006 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const BRASILIA = { lat: -15.79, lng: -47.88 };
const HONG_KONG = { lat: 22.32, lng: 114.17 };

/**
 * Radial profile of the arc exactly as three-globe builds it (ArcsLayer.calcCurve): a cubic Bezier
 * from a to b with control points at 25 % / 75 % of the great circle, 1.5 x the altitude out.
 * Returns heights above the surface (globe radii) at the interior samples.
 */
function globeGlArcProfile(a: LatLng, b: LatLng, altitude: number, samples = 512) {
  const cart = (p: LatLng, alt = 0) => {
    const phi = toRad(90 - p.lat), theta = toRad(90 - p.lng), r = 1 + alt;
    return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
  };
  const P = [cart(a), cart(interpolate(a, b, 0.25), altitude * 1.5), cart(interpolate(a, b, 0.75), altitude * 1.5), cart(b)];
  const heights: number[] = [];
  for (let i = 1; i < samples; i++) {
    const t = i / samples, u = 1 - t;
    const w = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
    const v = [0, 1, 2].map((k) => w[0] * P[0][k] + w[1] * P[1][k] + w[2] * P[2][k] + w[3] * P[3][k]);
    heights.push(Math.hypot(v[0], v[1], v[2]) - 1);
  }
  return { min: Math.min(...heights), max: Math.max(...heights), mid: heights[samples / 2 - 1] };
}

describe('coordinates', () => {
  it('haversine distance matches known great-circle distances', () => {
    expect(haversineKm(NYC, LONDON)).toBeCloseTo(5570, -2); // ±50 km
    expect(haversineKm(LONDON, SYDNEY)).toBeCloseTo(16990, -2);
    expect(haversineKm(NYC, NYC)).toBe(0);
  });

  it('bearing from New York to London is north-east', () => {
    const b = bearing(NYC, LONDON);
    expect(b).toBeGreaterThan(40);
    expect(b).toBeLessThan(60);
  });

  it('interpolation endpoints and midpoint are sane', () => {
    expect(interpolate(NYC, LONDON, 0)).toEqual(NYC);
    const end = interpolate(NYC, LONDON, 1);
    expect(end.lat).toBeCloseTo(LONDON.lat, 5);
    expect(end.lng).toBeCloseTo(LONDON.lng, 5);
    const mid = interpolate(NYC, LONDON, 0.5);
    // great-circle midpoint bows north of the straight line
    expect(mid.lat).toBeGreaterThan(50);
    expect(haversineKm(NYC, mid)).toBeCloseTo(haversineKm(mid, LONDON), 0);
  });

  it('centroid handles the antimeridian', () => {
    const c = centroid([{ lat: 0, lng: 179 }, { lat: 0, lng: -179 }]);
    expect(Math.abs(c.lng)).toBeGreaterThan(179);
    expect(c.lat).toBeCloseTo(0, 5);
  });

  it('wraps longitudes', () => {
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(180)).toBe(-180);
  });

  it('camera altitude grows with span and is clamped', () => {
    expect(altitudeForSpanKm(500)).toBeCloseTo(0.94, 1);
    expect(altitudeForSpanKm(20000)).toBeCloseTo(2.6, 5);
    expect(altitudeForSpanKm(1e9)).toBe(2.6);
  });

  it('arc clearance grows with distance between the configured bounds', () => {
    expect(arcClearanceFor(0)).toBe(ARC_CLEARANCE_MIN);
    expect(arcClearanceFor(Math.PI)).toBe(ARC_CLEARANCE_MAX);
    expect(arcClearanceFor(Math.PI / 2)).toBeCloseTo((ARC_CLEARANCE_MIN + ARC_CLEARANCE_MAX) / 2, 6);
    expect(arcClearanceFor(10)).toBe(ARC_CLEARANCE_MAX); // clamped
  });

  it('every arc stays above the surface along its whole length, short hops to antipodal routes', () => {
    const origin = { lat: 0, lng: 0 };
    for (const deg of [0.5, 5, 15, 30, 60, 90, 120, 150, 170, 179.5]) {
      const target = { lat: 0, lng: deg };
      const altitude = arcAltitudeFor(origin, target);
      const { min, mid, max } = globeGlArcProfile(origin, target, altitude);
      const theta = toRad(deg);
      expect(min, `${deg} deg arc dips into the globe`).toBeGreaterThan(0);
      expect(mid, `${deg} deg arc midpoint clearance`).toBeCloseTo(arcClearanceFor(theta), 3);
      expect(max, `${deg} deg arc leaves the atmosphere`).toBeLessThan(0.22);
    }
  });

  it('long arcs are lifted more than short ones and real routes clear the surface', () => {
    const hop = arcAltitudeFor(NYC, LONDON);
    const haul = arcAltitudeFor(BRASILIA, HONG_KONG);
    expect(haul).toBeGreaterThan(hop * 3);
    for (const [a, b] of [[NYC, LONDON], [LONDON, SYDNEY], [BRASILIA, HONG_KONG]] as const) {
      const p = globeGlArcProfile(a, b, arcAltitudeFor(a, b));
      expect(p.min).toBeGreaterThan(0);
      expect(p.mid).toBeCloseTo(arcClearanceFor(haversineKm(a, b) / EARTH_RADIUS_KM), 3);
    }
  });

  it('point-in-polygon with holes', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    expect(pointInPolygon({ lat: 2, lng: 2 }, [square])).toBe(true);
    expect(pointInPolygon({ lat: 12, lng: 2 }, [square])).toBe(false);
    expect(pointInPolygon({ lat: 5, lng: 5 }, [square, hole])).toBe(false);
    expect(pointInPolygon({ lat: 5, lng: 8 }, [square, hole])).toBe(true);
  });
});
