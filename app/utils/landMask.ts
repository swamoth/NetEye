/**
 * Rasterise country polygons with an equirectangular projection (row 0 = lat 90, col 0 =
 * lng -180). Shared by the ASCII boot world and the dot-matrix globe material, so both are
 * drawn from the same Natural Earth geometry the globe's country layer uses.
 *
 * Browser only (needs a 2D canvas); returns null on the server or before polygons exist.
 */

import type { Polygon, MultiPolygon } from 'geojson';
import type { CountryFeature } from '@/app/hooks/useGeoData';

export interface LandMask {
  cols: number;
  rows: number;
  /** 1 byte per cell, 1 = land. */
  data: Uint8Array;
  /** 1 when the point is on land. Longitudes outside [-180, 180) wrap. */
  at(lat: number, lng: number): 0 | 1;
}

function tracePolygons(ctx: CanvasRenderingContext2D, geometry: Polygon | MultiPolygon, cols: number, rows: number) {
  const px = (lng: number) => ((lng + 180) / 360) * cols;
  const py = (lat: number) => ((90 - lat) / 180) * rows;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    ctx.beginPath();
    for (const ring of poly) {
      ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(px(lng), py(lat)) : ctx.moveTo(px(lng), py(lat))));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
}

function canvasContext(cols: number, rows: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  return off.getContext('2d', { willReadFrequently: true });
}

export function landMask(countries: CountryFeature[], cols: number, rows: number): LandMask | null {
  if (!countries.length || cols < 2 || rows < 2) return null;
  const ctx = canvasContext(cols, rows);
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  for (const c of countries) tracePolygons(ctx, c.geometry, cols, rows);
  const rgba = ctx.getImageData(0, 0, cols, rows).data;
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3] > 96 ? 1 : 0;
  return {
    cols,
    rows,
    data,
    at(lat, lng) {
      const x = Math.min(cols - 1, Math.max(0, Math.floor((((((lng + 180) % 360) + 360) % 360) / 360) * cols)));
      const y = Math.min(rows - 1, Math.max(0, Math.floor(((90 - lat) / 180) * rows)));
      return data[y * cols + x] as 0 | 1;
    },
  };
}

/** Same mask as `landMask`, but with 255 for land so it can feed a single-channel texture. */
export function landMaskBytes(countries: CountryFeature[], cols: number, rows: number): Uint8Array | null {
  const mask = landMask(countries, cols, rows);
  if (!mask) return null;
  const out = new Uint8Array(mask.data.length);
  for (let i = 0; i < out.length; i++) out[i] = mask.data[i] ? 255 : 0;
  return out;
}

export interface TintEntry {
  geometry: Polygon | MultiPolygon;
  /** Solid CSS colour; alpha in the output marks tinted cells. */
  color: string;
}

/** RGBA cells: each entry's polygons painted in its colour, everything else transparent. */
export function countryTint(entries: TintEntry[], cols: number, rows: number): Uint8Array | null {
  const ctx = canvasContext(cols, rows);
  if (!ctx) return null;
  for (const e of entries) {
    ctx.fillStyle = e.color;
    tracePolygons(ctx, e.geometry, cols, rows);
  }
  return new Uint8Array(ctx.getImageData(0, 0, cols, rows).data.buffer);
}
