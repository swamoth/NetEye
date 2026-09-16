/**
 * Cloudflare Radar client for the ASN explorer (TypeScript side of the house).
 *
 * The incident feed uses server/sources/cloudflareRadar.js; this module covers the per-ASN
 * endpoints. Same token, same caching posture: 10-minute in-memory TTL, 8 s timeout, never throws.
 */

const BASE = 'https://api.cloudflare.com/client/v4/radar';
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;

const cache = new Map<string, { at: number; data: unknown }>();

export const radarEnabled = () => Boolean(process.env.CLOUDFLARE_API_TOKEN);

async function radar<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return null;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    const body = (await res.json().catch(() => null)) as { success?: boolean; result?: T } | null;
    if (!res.ok || !body || body.success === false || body.result == null) return null;
    cache.set(key, { at: Date.now(), data: body.result });
    return body.result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface RadarAsnEntity {
  asn: number;
  name: string;
  aka?: string;
  orgName?: string;
  website?: string;
  country?: string;
  countryName?: string;
  estimatedUsers?: { estimatedUsers?: number; locations?: { locationAlpha2: string; locationName: string; estimatedUsers: number }[] };
}

export async function asnEntity(asn: number): Promise<RadarAsnEntity | null> {
  const r = await radar<{ asn: RadarAsnEntity }>(`/entities/asns/${asn}`);
  return r?.asn ?? null;
}

/** Names/countries for a batch of ASNs in one call. */
export async function asnEntities(asns: number[]): Promise<Map<number, RadarAsnEntity>> {
  const out = new Map<number, RadarAsnEntity>();
  if (!asns.length) return out;
  const r = await radar<{ asns: RadarAsnEntity[] }>('/entities/asns', { asn: asns.slice(0, 50).join(','), limit: 50 });
  for (const a of r?.asns ?? []) out.set(Number(a.asn), a);
  return out;
}

export interface RadarRouteStats {
  routes_total: number;
  routes_valid: number;
  routes_invalid: number;
  routes_unknown: number;
  distinct_prefixes: number;
  distinct_origins: number;
  distinct_prefixes_ipv4?: number;
  distinct_prefixes_ipv6?: number;
}

export async function routeStats(asn: number): Promise<RadarRouteStats | null> {
  const r = await radar<{ stats: RadarRouteStats }>('/bgp/routes/stats', { asn });
  return r?.stats ?? null;
}

export interface RadarHijackEvent {
  id: number;
  hijacker_asn: number;
  victim_asns: number[];
  prefixes: string[];
  min_hijack_ts: string;
  max_hijack_ts?: string;
  confidence_score: number;
  peer_ip_count: number;
}

export interface RadarLeakEvent {
  id: number;
  leak_asn: number;
  leak_seg: number[];
  prefix_count: number;
  origin_count: number;
  min_ts: string;
  max_ts?: string;
  finished?: boolean;
}

export async function hijacksInvolving(asn: number, dateRange = '7d'): Promise<RadarHijackEvent[]> {
  const r = await radar<{ events: RadarHijackEvent[] }>('/bgp/hijacks/events', { involvedAsn: asn, dateRange, per_page: 20, sortBy: 'TIME', sortOrder: 'DESC', minConfidence: 4 });
  return r?.events ?? [];
}

export async function leaksInvolving(asn: number, dateRange = '7d'): Promise<RadarLeakEvent[]> {
  const r = await radar<{ events: RadarLeakEvent[] }>('/bgp/leaks/events', { involvedAsn: asn, dateRange, per_page: 20, sortBy: 'TIME', sortOrder: 'DESC' });
  return r?.events ?? [];
}

/** Radar BGP timestamps come without a timezone suffix; they are UTC. */
export function parseRadarTs(s?: string | null): number {
  if (!s) return NaN;
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`);
}
