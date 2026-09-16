import { describe, expect, it } from 'vitest';
import { latLng, latticePoint, latticeSpacing, nearestBruteForce, nearestLattice, unitVector, type Vec3 } from '../app/globe/fibonacci';

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
function randomUnit(rnd: () => number): Vec3 {
  const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), z, r * Math.sin(t)];
}

describe('spherical Fibonacci lattice', () => {
  it('lattice points sit on the unit sphere with the polar axis on y', () => {
    for (const i of [0, 1, 7, 500, 15999]) {
      const p = latticePoint(i, 16000);
      expect(Math.hypot(...p)).toBeCloseTo(1, 9);
    }
    expect(latticePoint(0, 16000)[1]).toBe(1); // first point at the north pole
  });

  it('the O(1) inverse lookup matches a brute-force search', () => {
    const rnd = seeded(7);
    let mismatches = 0;
    for (let n of [16000, 22000]) {
      for (let i = 0; i < 300; i++) {
        const p = randomUnit(rnd);
        const fast = nearestLattice(p, n);
        const slow = nearestBruteForce(p, n);
        // Either the same point, or one at (numerically) the same distance.
        if (fast.index !== slow.index && Math.abs(fast.dist - slow.dist) > 1e-9) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('every direction is within one lattice spacing of a lattice point', () => {
    const rnd = seeded(11);
    const n = 22000;
    for (let i = 0; i < 500; i++) {
      const p = randomUnit(rnd);
      expect(nearestLattice(p, n).dist).toBeLessThan(latticeSpacing(n));
    }
  });

  it('unitVector and latLng round-trip in three-globe convention', () => {
    for (const [lat, lng] of [[0, 0], [51.5, -0.13], [-33.9, 151.2], [89, 179], [-45, -179.5]]) {
      const v = unitVector(lat, lng);
      expect(Math.hypot(...v)).toBeCloseTo(1, 9);
      const back = latLng(v);
      expect(back.lat).toBeCloseTo(lat, 6);
      expect(back.lng).toBeCloseTo(lng, 6);
    }
    // prime meridian, equator faces +z (three-globe: theta = 90 - lng)
    expect(unitVector(0, 0)[2]).toBeCloseTo(1, 9);
    expect(unitVector(90, 0)[1]).toBeCloseTo(1, 9);
  });
});
