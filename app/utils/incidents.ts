import type { Incident, IncidentStatus, IncidentType, Severity } from './types';
import { INCIDENT_TYPES, SEVERITIES } from './types';
import { SEVERITY_META } from './theme';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** Resolved incidents stay visible on the globe (fading) for this long. */
export const RESOLVED_LINGER_MS = 20 * 60 * 1000;

/** Status of an incident at time `t` (ms), or null if it has not started yet. */
export function statusAt(inc: Pick<Incident, 'startedAt' | 'mitigatingAt' | 'resolvedAt'>, t: number): IncidentStatus | null {
  const start = Date.parse(inc.startedAt);
  if (t < start) return null;
  if (inc.resolvedAt && t >= Date.parse(inc.resolvedAt)) return 'resolved';
  if (inc.mitigatingAt && t >= Date.parse(inc.mitigatingAt)) return 'mitigating';
  return 'active';
}

/** Should the incident be drawn on the globe at time `t`? */
export function isVisibleAt(inc: Incident, t: number): boolean {
  const s = statusAt(inc, t);
  if (!s) return false;
  if (s !== 'resolved') return true;
  return t - Date.parse(inc.resolvedAt as string) <= RESOLVED_LINGER_MS;
}

/** 0..1 opacity factor for fading resolved incidents out. */
export function fadeAt(inc: Incident, t: number): number {
  if (statusAt(inc, t) !== 'resolved') return 1;
  const since = t - Date.parse(inc.resolvedAt as string);
  return Math.max(0, 1 - since / RESOLVED_LINGER_MS);
}

export interface IncidentFilter {
  types?: Set<IncidentType> | IncidentType[];
  severities?: Set<Severity> | Severity[];
  statuses?: Set<IncidentStatus> | IncidentStatus[];
  /** Only incidents whose active interval intersects [since, now]. */
  since?: number;
  q?: string;
  asn?: number;
  countryCode?: string;
  /** When set, `statuses` is evaluated at this time instead of the server status. */
  at?: number;
}

const toSet = <T,>(v?: Set<T> | T[]) => (v == null ? null : v instanceof Set ? v : new Set(v));

export function matchesQuery(inc: Incident, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    inc.title,
    inc.description,
    inc.type,
    inc.type.replace('_', ' '),
    inc.severity,
    inc.status,
    inc.location.city,
    inc.location.country,
    inc.location.countryCode,
    inc.location.region,
    inc.cause,
    inc.cable?.name,
    inc.sourceName,
    ...inc.affectedASNs.flatMap((a) => [`as${a.asn}`, String(a.asn), a.name]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function filterIncidents(incidents: Incident[], f: IncidentFilter): Incident[] {
  const types = toSet(f.types);
  const sevs = toSet(f.severities);
  const statuses = toSet(f.statuses);
  return incidents.filter((inc) => {
    if (types && !types.has(inc.type)) return false;
    if (sevs && !sevs.has(inc.severity)) return false;
    if (statuses) {
      const s = f.at != null ? statusAt(inc, f.at) : inc.status;
      if (!s || !statuses.has(s)) return false;
    }
    if (f.since != null) {
      const end = inc.resolvedAt ? Date.parse(inc.resolvedAt) : Infinity;
      if (end < f.since) return false;
    }
    if (f.asn != null && !inc.affectedASNs.some((a) => a.asn === f.asn)) return false;
    if (f.countryCode && inc.location.countryCode !== f.countryCode) return false;
    if (f.q && !matchesQuery(inc, f.q)) return false;
    return true;
  });
}

const STATUS_RANK: Record<IncidentStatus, number> = { active: 0, mitigating: 1, resolved: 2 };

/** Active first, then severity, then most recent. */
export function sortIncidents(incidents: Incident[], at?: number): Incident[] {
  return [...incidents].sort((a, b) => {
    const sa = (at != null ? statusAt(a, at) : a.status) ?? 'resolved';
    const sb = (at != null ? statusAt(b, at) : b.status) ?? 'resolved';
    if (STATUS_RANK[sa] !== STATUS_RANK[sb]) return STATUS_RANK[sa] - STATUS_RANK[sb];
    if (SEVERITY_META[a.severity].rank !== SEVERITY_META[b.severity].rank) return SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });
}

export interface KpiSummary {
  active: number;
  mitigating: number;
  resolved: number;
  critical: number;
  high: number;
  /** Distinct countries with a non-resolved, non-aggregated incident. */
  countries: number;
  /** Distinct ASNs named in non-resolved incidents. */
  asns: number;
  /** Sum of the DDoS share percentages currently tracked. */
  ddosSharePct: number | null;
  byType: Record<IncidentType, number>;
  activeByType: Record<IncidentType, number>;
  bySeverity: Record<Severity, number>;
}

/** KPI roll-up for the dashboard, evaluated at time `t`. Counts only — nothing is estimated. */
export function summarize(incidents: Incident[], t: number): KpiSummary {
  const byType = Object.fromEntries(INCIDENT_TYPES.map((k) => [k, 0])) as Record<IncidentType, number>;
  const activeByType = Object.fromEntries(INCIDENT_TYPES.map((k) => [k, 0])) as Record<IncidentType, number>;
  const bySeverity = Object.fromEntries(SEVERITIES.map((k) => [k, 0])) as Record<Severity, number>;
  const out: KpiSummary = { active: 0, mitigating: 0, resolved: 0, critical: 0, high: 0, countries: 0, asns: 0, ddosSharePct: null, byType, activeByType, bySeverity };
  const countries = new Set<string>();
  const asns = new Set<number>();
  let share = 0;
  let hasShare = false;
  for (const inc of incidents) {
    const s = statusAt(inc, t);
    if (!s) continue;
    byType[inc.type] += 1;
    bySeverity[inc.severity] += 1;
    if (s === 'resolved') { out.resolved += 1; continue; }
    if (s === 'active') out.active += 1; else out.mitigating += 1;
    activeByType[inc.type] += 1;
    if (inc.severity === 'critical') out.critical += 1;
    if (inc.severity === 'high') out.high += 1;
    if (!inc.aggregated) countries.add(inc.location.countryCode);
    for (const a of inc.affectedASNs) asns.add(a.asn);
    if (typeof inc.metrics.sharePct === 'number') { share += inc.metrics.sharePct; hasShare = true; }
  }
  out.countries = countries.size;
  out.asns = asns.size;
  out.ddosSharePct = hasShare ? Math.round(share * 10) / 10 : null;
  return out;
}

/** Histogram of incident starts across `bins` equal slices of [from, to). */
export function histogram(incidents: Incident[], from: number, to: number, bins: number): Record<IncidentType, number>[] {
  const out = Array.from({ length: bins }, () => Object.fromEntries(INCIDENT_TYPES.map((k) => [k, 0])) as Record<IncidentType, number>);
  const width = (to - from) / bins;
  for (const inc of incidents) {
    if (inc.aggregated) continue;
    const s = Date.parse(inc.startedAt);
    if (s < from || s >= to) continue;
    out[Math.min(bins - 1, Math.floor((s - from) / width))][inc.type] += 1;
  }
  return out;
}

/** Merge WebSocket diffs into the incident map. */
export function applyUpdate(prev: Map<string, Incident>, added: Incident[], updated: Incident[], removed: string[]): Map<string, Incident> {
  const next = new Map(prev);
  for (const id of removed) next.delete(id);
  for (const inc of [...added, ...updated]) next.set(inc.id, inc);
  return next;
}
