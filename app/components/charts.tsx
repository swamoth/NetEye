'use client';

/**
 * Small chart primitives used by the dashboard and the ASN explorer.
 *
 * Mark specs (dataviz): bars <= 24px thick with a 4px rounded data-end and a square baseline,
 * 2px surface gaps between touching fills, 2px lines, area washes at ~10%, hairline solid grid,
 * neutral text tokens (never the series colour), a legend for >= 2 series, and a table twin
 * for screen readers.
 */

import { useId } from 'react';
import { SURFACE, TEXT } from '@/app/utils/theme';
import { Dot } from './ui';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Percent label that never rounds a real remainder away (99.7% stays 99.7%, 0.3% shows as <1%). */
export function sharePct(value: number, total: number): string {
  if (!total || value <= 0) return '0%';
  const pct = (value / total) * 100;
  if (pct >= 100) return '100%';
  if (pct > 99.5) return `${pct.toFixed(1)}%`;
  if (pct < 0.5) return '<1%';
  return `${Math.round(pct)}%`;
}

/** Horizontal part-to-whole bar with legend. Values are absolute; the bar shows shares. */
export function StackedBar({ segments, height = 10, ariaLabel, format = (v: number) => String(v) }: { segments: Segment[]; height?: number; ariaLabel: string; format?: (v: number) => string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <figure className="m-0">
      <div className="flex w-full overflow-hidden rounded-[4px]" style={{ height, background: SURFACE, gap: 2 }} role="img" aria-label={ariaLabel}>
        {total === 0 ? (
          <div className="h-full w-full rounded-[4px] bg-slate-700/40" />
        ) : (
          visible.map((s) => (
            <div key={s.key} className="h-full rounded-[2px] first:rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: 3 }} title={`${s.label}: ${format(s.value)} (${sharePct(s.value, total)})`} />
          ))
        )}
      </div>
      <figcaption className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <Dot color={s.color} />
            {s.label}
            <span className="tnum text-slate-400">{format(s.value)}{total ? ` (${sharePct(s.value, total)})` : ''}</span>
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}><th scope="row">{s.label}</th><td>{format(s.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  sub?: string;
  onClick?: () => void;
}

/** Single-hue horizontal bars with direct labels; nominal categories, so one colour. */
export function BarList({ items, color, ariaLabel, format = (v: number) => String(v), max }: { items: BarItem[]; color: string; ariaLabel: string; format?: (v: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="m-0">
      <ul className="space-y-1.5" aria-label={ariaLabel}>
        {items.map((it) => {
          const row = (
            <>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate text-slate-200">{it.label}</span>
                <span className="tnum shrink-0 text-slate-300">{format(it.value)}</span>
              </div>
              <div className="mt-1 h-[6px] w-full rounded-[3px]" style={{ background: 'rgba(148,163,184,0.10)' }}>
                <div className="h-full rounded-r-[3px]" style={{ width: `${Math.max(2, (it.value / top) * 100)}%`, background: color }} />
              </div>
              {it.sub && <div className="mt-0.5 text-[10px] text-slate-400">{it.sub}</div>}
            </>
          );
          return (
            <li key={it.key}>
              {it.onClick ? (
                <button type="button" onClick={it.onClick} className="block w-full rounded-block px-1 py-0.5 text-left transition-colors hover:bg-slate-700/40">
                  {row}
                </button>
              ) : (
                <div className="px-1 py-0.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Single-series line with a 10% area wash. `data` is oldest -> newest. */
export function Sparkline({ data, color, height = 44, ariaLabel, unit = '' }: { data: number[]; color: string; height?: number; ariaLabel: string; unit?: string }) {
  const id = useId();
  const w = 320;
  const h = height;
  const pad = 3;
  const max = Math.max(1, ...data);
  const n = Math.max(2, data.length);
  const pts = data.map((v, i) => [pad + (i / (n - 1)) * (w - pad * 2), pad + (1 - v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z` : '';
  const last = data[data.length - 1] ?? 0;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none" role="img" aria-label={`${ariaLabel}. Latest ${last}${unit}, peak ${max}${unit}.`}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
        {pts.length > 1 && <path d={area} fill={`url(#${id}-fill)`} />}
        {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {pts.length > 0 && (
          <>
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill={SURFACE} />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
          </>
        )}
      </svg>
      <figcaption className="mt-0.5 flex justify-between text-[10px]" style={{ color: TEXT.muted }}>
        <span>peak {max}{unit}</span>
        <span className="tnum" style={{ color: TEXT.secondary }}>now {last}{unit}</span>
      </figcaption>
    </figure>
  );
}
