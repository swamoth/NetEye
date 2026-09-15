import { describe, expect, it } from 'vitest';
import { DOT_EARTH_DEFAULTS, dotGrid } from '../app/utils/dotEarth';

describe('dotEarth grid', () => {
  it('spaces dots uniformly on the sphere: fewer per row towards the poles', () => {
    const cells = dotGrid(2);
    const perRow = new Map<number, number>();
    for (const c of cells) perRow.set(c.lat, (perRow.get(c.lat) ?? 0) + 1);
    expect(perRow.get(0)).toBe(180); // 360 / 2 at the equator
    expect(perRow.get(60)).toBe(90); // cos 60 = 0.5
    expect(perRow.get(-60)).toBe(90);
    expect(perRow.get(80)).toBeLessThan(perRow.get(60)!);
  });

  it('tiles each row across the full 360 degrees without a seam', () => {
    const row = dotGrid(2).filter((c) => c.lat === 30);
    const lngs = row.map((c) => c.lng).sort((a, b) => a - b);
    expect(lngs[0]).toBeGreaterThanOrEqual(-180);
    expect(lngs[lngs.length - 1]).toBeLessThan(180);
    const step = lngs[1] - lngs[0];
    expect(lngs[0] + 180).toBeCloseTo(step / 2, 6); // half a step in from the antimeridian
    expect(lngs[lngs.length - 1]).toBeCloseTo(180 - step / 2, 6);
  });

  it('stretches dots horizontally by 1/cos(lat) so they render round on the globe, capped near the poles', () => {
    const cells = dotGrid(2);
    expect(cells.find((c) => c.lat === 0)!.stretch).toBeCloseTo(1, 6);
    expect(cells.find((c) => c.lat === 60)!.stretch).toBeCloseTo(2, 6);
    expect(cells.find((c) => c.lat === 88)!.stretch).toBeLessThanOrEqual(6);
    expect(cells.some((c) => Math.abs(c.lat) > DOT_EARTH_DEFAULTS.maxLat)).toBe(false);
  });
});
