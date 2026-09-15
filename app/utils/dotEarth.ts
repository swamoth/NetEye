/**
 * Dot-matrix Earth texture.
 *
 * Builds the globe's surface at runtime from the same Natural Earth polygons the country layer
 * and the ASCII boot screen use: a flat off-black ocean and one grey dot per land cell, laid out
 * on a grid that is uniform *on the sphere* (longitude spacing widens by 1/cos(lat), and each dot
 * is stretched the same way in texture space so it lands round on the globe). No photo texture,
 * no bump map, no stars: the only colour on the globe is the data.
 */

import type { CountryFeature } from '@/app/hooks/useGeoData';
import { landMask } from './landMask';
import { toRad } from './coordinates';

export interface DotEarthOptions {
  /** Texture width in px; height is width / 2 (equirectangular). */
  width?: number;
  /** Grid spacing in degrees at the equator. */
  spacingDeg?: number;
  /** Dot radius as a fraction of the grid spacing. */
  dotRatio?: number;
  /** Highest latitude that gets dots; the poles themselves are ocean-coloured. */
  maxLat?: number;
  ocean?: string;
  land?: string;
}

export const DOT_EARTH_DEFAULTS: Required<DotEarthOptions> = {
  width: 4096,
  spacingDeg: 1.4,
  dotRatio: 0.36,
  maxLat: 88,
  ocean: '#141414',
  land: '#6f6f6f',
};

export interface DotCell {
  lat: number;
  lng: number;
  /** Horizontal stretch to apply in equirectangular space so the dot is round on the sphere. */
  stretch: number;
}

/**
 * Dot centres for a grid that is (nearly) equally spaced on the sphere: rows every
 * `spacingDeg` of latitude, and along each row a longitude step of spacingDeg / cos(lat),
 * rounded so the row tiles the full 360 degrees without a seam.
 */
export function dotGrid(spacingDeg: number, maxLat = DOT_EARTH_DEFAULTS.maxLat): DotCell[] {
  const out: DotCell[] = [];
  const rows = Math.floor(180 / spacingDeg);
  for (let r = 0; r <= rows; r++) {
    const lat = 90 - r * spacingDeg;
    if (Math.abs(lat) > maxLat) continue;
    const cosLat = Math.max(Math.cos(toRad(lat)), 1e-3);
    const count = Math.max(1, Math.round((360 * cosLat) / spacingDeg));
    const step = 360 / count;
    const stretch = Math.min(1 / cosLat, 6);
    for (let i = 0; i < count; i++) out.push({ lat, lng: -180 + (i + 0.5) * step, stretch });
  }
  return out;
}

/** Paint the texture into a canvas and return it (browser only). */
export function paintDotEarth(countries: CountryFeature[], opts: DotEarthOptions = {}): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const o = { ...DOT_EARTH_DEFAULTS, ...opts };
  const width = o.width, height = o.width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = o.ocean;
  ctx.fillRect(0, 0, width, height);

  const mask = landMask(countries, 2048, 1024);
  if (!mask) return canvas; // plain sphere until polygons exist

  const pxPerDeg = width / 360;
  const ry = o.spacingDeg * pxPerDeg * o.dotRatio;
  ctx.fillStyle = o.land;
  for (const d of dotGrid(o.spacingDeg, o.maxLat)) {
    if (!mask.at(d.lat, d.lng)) continue;
    const x = ((d.lng + 180) / 360) * width;
    const y = ((90 - d.lat) / 180) * height;
    ctx.beginPath();
    ctx.ellipse(x, y, ry * d.stretch, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Build the texture and hand back an object URL for globe.gl's globeImageUrl. */
export function buildDotEarthTexture(countries: CountryFeature[], opts: DotEarthOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = paintDotEarth(countries, opts);
    if (!canvas) return reject(new Error('no canvas'));
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
