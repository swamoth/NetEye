'use client';

/**
 * The world as a shimmering ASCII field.
 *
 * Land comes from the same Natural Earth polygons the globe uses (rasterised once into a
 * cell mask with an equirectangular projection, see utils/landMask.ts), so this is real
 * geography, not a texture.
 * Value noise drifts over it: land cells glow through the character ramp, ocean cells stay
 * mostly empty with a sparse drift, and the pointer lifts whatever it passes over.
 *
 * Character ramp + noise field adapted from Ege Chelebi's blog (github.com/woosal1337/blog,
 * MIT); the land mask and its projection are NetEye's.
 */

import { useMemo, useRef, type HTMLAttributes } from 'react';
import type { CountryFeature } from '@/app/hooks/useGeoData';
import { useCanvasAnimation } from '@/app/hooks/useCanvasAnimation';
import { landMask, type LandMask } from '@/app/utils/landMask';

const FONT = 'var(--font-geist-mono), ui-monospace, monospace';
const RAMP = ' .:-=+*#%@';
const INK: [number, number, number] = [245, 245, 245];
const INK_MUTE: [number, number, number] = [120, 120, 120];
const MAX_COLS = 120;

function hash2(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export interface AsciiWorldProps extends HTMLAttributes<HTMLDivElement> {
  countries: CountryFeature[];
  /** Cell width in px; height is 1.15x. */
  cell?: number;
}

export default function AsciiWorld({ countries, cell = 10, className = '', ...rest }: AsciiWorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<{ key: string; mask: LandMask | null }>({ key: '', mask: null });
  const version = useMemo(() => countries.length, [countries]);

  useCanvasAnimation(
    canvasRef,
    hostRef,
    ({ ctx, width, height, time, pointer }) => {
      const cellH = cell * 1.15;
      // Fit a 2:1 map into the host, centred.
      const cols = Math.min(MAX_COLS, Math.floor(width / cell));
      const rows = Math.max(2, Math.floor((cols * cell) / (2 * cellH)));
      const mapW = cols * cell, mapH = rows * cellH;
      const ox = (width - mapW) / 2, oy = (height - mapH) / 2;

      const key = `${version}:${cols}x${rows}`;
      if (maskRef.current.key !== key) maskRef.current = { key, mask: landMask(countries, cols, rows) };
      const mask = maskRef.current.mask;

      ctx.clearRect(0, 0, width, height);
      ctx.font = `${cell}px ${FONT}`;
      ctx.textBaseline = 'top';
      const t = time;

      for (let row = 0; row < rows; row++) {
        const py = oy + row * cellH;
        for (let col = 0; col < cols; col++) {
          const px = ox + col * cell;
          const n1 = valueNoise(col * 0.12 + t * 0.15, row * 0.14 - t * 0.1);
          const n2 = valueNoise(col * 0.045 - t * 0.06, row * 0.05 + t * 0.08);
          let n = n1 * 0.65 + n2 * 0.35;
          if (pointer.inside) {
            const dx = px - pointer.x, dy = py - pointer.y;
            n += Math.exp(-(dx * dx + dy * dy) / (90 * 90)) * 0.55;
          }
          const land = mask ? mask.data[row * cols + col] === 1 : false;
          let k: number;
          if (mask) {
            if (land) k = 0.35 + 0.65 * Math.min(1, n);
            else if (n > 0.62) k = ((n - 0.62) / 0.38) * 0.35;
            else continue;
          } else {
            // No polygons yet: plain drifting field, same as a loading haze.
            if (n <= 0.42) continue;
            k = (n - 0.42) / 0.58;
          }
          const ci = Math.min(RAMP.length - 1, Math.floor(k * RAMP.length));
          const ch = RAMP[ci] ?? '@';
          if (ch === ' ') continue;
          const r = INK_MUTE[0] + (INK[0] - INK_MUTE[0]) * k;
          const g = INK_MUTE[1] + (INK[1] - INK_MUTE[1]) * k;
          const b = INK_MUTE[2] + (INK[2] - INK_MUTE[2]) * k;
          ctx.fillStyle = rgba([r, g, b], land ? 0.45 + k * 0.55 : 0.2 + k * 0.4);
          ctx.fillText(ch, px, py);
        }
      }
    },
    { fps: 30, reactive: true },
  );

  return (
    <div ref={hostRef} aria-hidden className={`relative overflow-hidden ${className}`} {...rest}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
