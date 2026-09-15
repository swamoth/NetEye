import type { IncidentType, Severity, IncidentStatus, AsnRole } from './types';

/**
 * Colour system.
 *
 * Incident types are a *categorical* palette (identity). The `color` steps were validated with
 * the dataviz palette checks against the dark panel surface: lightness band, chroma, CVD
 * separation (all pairs) and 3:1 contrast (higher still on the near-black #0a0a0a wells). Use `color` for anything drawn on panels: chips,
 * chart marks, histogram segments. `glow` is a brighter step of the same hue reserved for
 * emissive marks on the globe surface, where the surface is much darker and marks are tiny.
 *
 * Text never wears a data colour: identity comes from a coloured mark next to neutral text.
 */
export const TYPE_META: Record<IncidentType, { label: string; short: string; color: string; glow: string; description: string }> = {
  outage: { label: 'Outage', short: 'Outage', color: '#e11d48', glow: '#fb7185', description: 'Country or network-level connectivity loss' },
  bgp: { label: 'BGP anomaly', short: 'BGP', color: '#8b5cf6', glow: '#a78bfa', description: 'Route leak or prefix hijack seen by RIS collectors' },
  ddos: { label: 'DDoS', short: 'DDoS', color: '#0891b2', glow: '#22d3ee', description: 'Layer-3 attack traffic by origin and target country' },
  cable_cut: { label: 'Cable fault', short: 'Cable', color: '#d97706', glow: '#fbbf24', description: 'Submarine cable disruption' },
};

/** Ordered for stacking and legends; matches INCIDENT_TYPES. */
export const TYPE_ORDER: IncidentType[] = ['outage', 'bgp', 'ddos', 'cable_cut'];

/** Severity is an ordinal scale: one hue family, darker = more severe, plus a rank for sizing. */
export const SEVERITY_META: Record<Severity, { label: string; color: string; rank: number; radius: number; altitude: number }> = {
  low: { label: 'Low', color: '#8a8a8a', rank: 0, radius: 0.22, altitude: 0.01 },
  medium: { label: 'Medium', color: '#d4d4d4', rank: 1, radius: 0.28, altitude: 0.016 },
  high: { label: 'High', color: '#fbbf24', rank: 2, radius: 0.36, altitude: 0.024 },
  critical: { label: 'Critical', color: '#f87171', rank: 3, radius: 0.46, altitude: 0.036 },
};

/** Status colours are reserved (good / warning / serious) and always shipped with a label. */
export const STATUS_META: Record<IncidentStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#f87171' },
  mitigating: { label: 'Mitigating', color: '#fbbf24' },
  resolved: { label: 'Resolved', color: '#34d399' },
};

export const ROLE_LABEL: Record<AsnRole, string> = {
  origin: 'affected',
  upstream: 'upstream',
  victim: 'victim',
  hijacker: 'hijacker',
  leaker: 'leaker',
};

/** The chrome has no hue: interactive, selection and focus are plain ink. */
export const ACCENT = '#f5f5f5';

/** Chart surface + text tokens (mirror globals.css / tailwind `well`, `fg`). */
export const SURFACE = '#0a0a0a';
export const TEXT = { primary: '#f5f5f5', secondary: '#a0a0a0', muted: '#787878' } as const;
/** Neutral marks for 'unknown' or inactive data states (never used for text). */
export const NEUTRAL = { mark: '#5a5a5a', track: 'rgba(255,255,255,0.08)', grid: 'rgba(255,255,255,0.14)' } as const;

export const typeColor = (t: IncidentType) => TYPE_META[t].color;

/** Hex colour with alpha (0..1) as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
