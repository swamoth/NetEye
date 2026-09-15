/**
 * Rasterise country polygons into a cols x rows land mask (1 = land) with an equirectangular
 * projection. Shared by the ASCII boot world and the dotted globe texture, so both are drawn
 * from the same Natural Earth geometry the globe's country layer uses.
 *
 * Browser only (needs a 2D canvas); returns null on the server or before polygons exist.
 */

import type { CountryFeature } from '@/app/hooks/useGeoData';

export interface LandMask {
  cols: number;
  rows: number;
  data: Uint8Array;
  /** 1 when the point is on land. Longitudes outside [-180, 180) wrap. */
  at(lat: number, lng: number): 0 | 1;
}

export function landMask(countries: CountryFeature[], cols: number, rows: number): LandMask | null {
  if (!countries.length || cols < 2 || rows < 2 || typeof document === 'undefined') return null;
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  const px = (lng: number) => ((lng + 180) / 360) * cols;
  const py = (lat: number) => ((90 - lat) / 180) * rows;
  for (const c of countries) {
    const polys = c.geometry.type === 'Polygon' ? [c.geometry.coordinates] : c.geometry.coordinates;
    for (const poly of polys) {
      ctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(px(lng), py(lat)) : ctx.moveTo(px(lng), py(lat))));
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
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
