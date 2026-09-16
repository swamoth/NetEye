/**
 * Server-side facade used by API routes and the SSR page. Wraps the store with the shared
 * filter/sort helpers so query semantics are identical to the client's.
 */

import type { Incident, IncidentStatus, IncidentType, Severity, Snapshot } from '@/app/utils/types';
import { INCIDENT_TYPES, SEVERITIES } from '@/app/utils/types';
import { filterIncidents } from '@/app/utils/incidents';
import { getStore } from './db';

export interface OutageQuery {
  type?: string | null;
  severity?: string | null;
  status?: string | null;
  since?: string | null;
  q?: string | null;
  asn?: string | null;
  country?: string | null;
  limit?: string | null;
}

const isType = (s: string): s is IncidentType => (INCIDENT_TYPES as string[]).includes(s);
const isSeverity = (s: string): s is Severity => (SEVERITIES as string[]).includes(s);
const isStatus = (s: string): s is IncidentStatus => ['active', 'mitigating', 'resolved'].includes(s);

function csv<T extends string>(v: string | null | undefined, guard: (s: string) => s is T): T[] | undefined {
  if (!v) return undefined;
  const items = v.split(',').map((s) => s.trim().toLowerCase()).filter(guard);
  return items.length ? items : undefined;
}

/** Parse an ISO timestamp, epoch ms, or relative "-6h" / "-30m" into ms. */
export function parseSince(v: string | null | undefined, now: number): number | undefined {
  if (!v) return undefined;
  const rel = /^-?(\d+)([smhd])$/.exec(v.trim());
  if (rel) {
    const mult = { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 }[rel[2] as 's' | 'm' | 'h' | 'd'];
    return now - Number(rel[1]) * mult;
  }
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
}

export async function queryOutages(query: OutageQuery, now = Date.now()): Promise<Snapshot & { count: number }> {
  const snap = await getStore().getSnapshot(now);
  let incidents: Incident[] = filterIncidents(snap.incidents, {
    types: csv(query.type, isType),
    severities: csv(query.severity, isSeverity),
    statuses: csv(query.status, isStatus),
    since: parseSince(query.since, now),
    q: query.q ?? undefined,
    asn: query.asn ? Number(String(query.asn).replace(/^as/i, '')) || undefined : undefined,
    countryCode: query.country ? query.country.toUpperCase() : undefined,
  });
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 1000));
  if (incidents.length > limit) incidents = incidents.slice(0, limit);
  return { ...snap, incidents, count: incidents.length };
}

export const getSnapshot = (now?: number) => getStore().getSnapshot(now);
export const getIncident = (id: string, now?: number) => getStore().getIncident(id, now);
export const getStats = (now?: number) => getStore().getStats(now);
export const getSources = (now?: number) => getStore().getSources(now);
