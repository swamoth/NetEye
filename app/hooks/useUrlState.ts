'use client';

import { useEffect, useRef } from 'react';
import type { IncidentType, Severity } from '@/app/utils/types';
import { INCIDENT_TYPES, SEVERITIES } from '@/app/utils/types';

/**
 * Shareable view state carried in the query string.
 *   ?incident=<id>          selected incident
 *   ?types=outage,bgp       type filter (omitted = all)
 *   ?sev=high,critical      severity filter (omitted = all)
 *   ?q=mumbai               search text
 *   ?t=<epoch ms | ISO>     replay time (omitted = live)
 *   ?pov=lat,lng,alt        camera point of view
 *   ?asn=13335              reserved for the ASN explorer
 */
export interface UrlState {
  incident: string | null;
  types: IncidentType[] | null;
  sev: Severity[] | null;
  q: string;
  t: number | null;
  pov: { lat: number; lng: number; altitude: number } | null;
  asn: number | null;
}

export const EMPTY_URL_STATE: UrlState = { incident: null, types: null, sev: null, q: '', t: null, pov: null, asn: null };

const isType = (s: string): s is IncidentType => (INCIDENT_TYPES as string[]).includes(s);
const isSev = (s: string): s is Severity => (SEVERITIES as string[]).includes(s);

export function readUrlState(search = typeof window !== 'undefined' ? window.location.search : ''): UrlState {
  const sp = new URLSearchParams(search);
  const types = sp.get('types')?.split(',').filter(isType) ?? null;
  const sev = sp.get('sev')?.split(',').filter(isSev) ?? null;
  const tRaw = sp.get('t');
  let t: number | null = null;
  if (tRaw) {
    const n = Number(tRaw);
    t = Number.isFinite(n) ? n : Date.parse(tRaw);
    if (Number.isNaN(t) || t >= Date.now()) t = null;
  }
  let pov: UrlState['pov'] = null;
  const povRaw = sp.get('pov')?.split(',').map(Number);
  if (povRaw && povRaw.length === 3 && povRaw.every(Number.isFinite)) pov = { lat: povRaw[0], lng: povRaw[1], altitude: povRaw[2] };
  const asnRaw = sp.get('asn');
  const asn = asnRaw ? Number(asnRaw.replace(/^as/i, '')) || null : null;
  return {
    incident: sp.get('incident'),
    types: types && types.length && types.length < INCIDENT_TYPES.length ? types : null,
    sev: sev && sev.length && sev.length < SEVERITIES.length ? sev : null,
    q: sp.get('q') ?? '',
    t,
    pov,
    asn,
  };
}

export function serializeUrlState(s: UrlState): string {
  const sp = new URLSearchParams();
  if (s.incident) sp.set('incident', s.incident);
  if (s.types && s.types.length && s.types.length < INCIDENT_TYPES.length) sp.set('types', s.types.join(','));
  if (s.sev && s.sev.length && s.sev.length < SEVERITIES.length) sp.set('sev', s.sev.join(','));
  if (s.q.trim()) sp.set('q', s.q.trim());
  if (s.t != null) sp.set('t', String(Math.round(s.t)));
  if (s.pov) sp.set('pov', `${s.pov.lat.toFixed(2)},${s.pov.lng.toFixed(2)},${s.pov.altitude.toFixed(2)}`);
  if (s.asn) sp.set('asn', String(s.asn));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Mirror `state` into the address bar (debounced, replaceState — no navigation, no re-render). */
export function useUrlStateWriter(state: UrlState, enabled = true): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialized = serializeUrlState(state);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = `${window.location.pathname}${serialized}`;
      if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, '', next);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [serialized, enabled]);
}

export function currentShareUrl(state: UrlState): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}${serializeUrlState(state)}`;
}
