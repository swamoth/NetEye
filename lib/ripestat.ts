/**
 * Minimal typed client for the keyless RIPEstat Data API (https://stat.ripe.net/docs/data_api).
 * Used by /api/whoami today; the ASN explorer milestone builds on the same client.
 *
 * RIPE asks integrators to identify themselves with `sourceapp`. Results are cached in memory
 * for 10 minutes; every call has a 6 s timeout and never throws — callers get `null` on failure.
 */

const BASE = 'https://stat.ripe.net/data';
const SOURCEAPP = 'neteye';
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 6000;

interface RipeEnvelope<T> {
  status: 'ok' | 'error' | 'maintenance';
  data: T;
  messages?: [string, string][];
}

const cache = new Map<string, { at: number; data: unknown }>();

async function ripe<T>(endpoint: string, params: Record<string, string> = {}, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  const url = new URL(`${BASE}/${endpoint}/data.json`);
  url.searchParams.set('sourceapp', SOURCEAPP);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as RipeEnvelope<T>;
    if (body.status !== 'ok') return null;
    cache.set(key, { at: Date.now(), data: body.data });
    return body.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Public IP as seen by RIPE (i.e. the *server's* egress IP — only useful in local dev). */
export async function whatsMyIp(): Promise<string | null> {
  const d = await ripe<{ ip: string }>('whats-my-ip');
  return d?.ip ?? null;
}

export interface NetworkInfo {
  asns: number[];
  prefix: string | null;
}

export async function networkInfo(ip: string): Promise<NetworkInfo | null> {
  const d = await ripe<{ asns: string[]; prefix: string }>('network-info', { resource: ip });
  if (!d) return null;
  return { asns: (d.asns || []).map(Number).filter(Number.isFinite), prefix: d.prefix || null };
}

export interface AsOverview {
  asn: number;
  holder: string | null;
  announced: boolean;
}

export async function asOverview(asn: number): Promise<AsOverview | null> {
  const d = await ripe<{ holder: string; announced: boolean; resource: string }>('as-overview', { resource: `AS${asn}` });
  if (!d) return null;
  return { asn, holder: d.holder?.trim() || null, announced: Boolean(d.announced) };
}

export interface GeoLocation {
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

export async function geolocateIp(ip: string): Promise<GeoLocation | null> {
  const d = await ripe<{
    located_resources: { resource: string; locations: { country: string; city: string; latitude: number; longitude: number; covered_percentage: number }[] }[];
  }>('maxmind-geo-lite', { resource: ip });
  const loc = d?.located_resources?.[0]?.locations?.sort((a, b) => b.covered_percentage - a.covered_percentage)[0];
  if (!loc) return null;
  return {
    country: loc.country || null,
    city: loc.city || null,
    lat: Number.isFinite(loc.latitude) ? loc.latitude : null,
    lng: Number.isFinite(loc.longitude) ? loc.longitude : null,
  };
}

/** Prefixes announced by an ASN — wired up for the ASN explorer milestone. */
export async function announcedPrefixes(asn: number): Promise<string[]> {
  const d = await ripe<{ prefixes: { prefix: string }[] }>('announced-prefixes', { resource: `AS${asn}` });
  return d?.prefixes?.map((p) => p.prefix) ?? [];
}

export interface RoutingStatus {
  announcedV4Prefixes: number;
  announcedV6Prefixes: number;
  visibility: { v4: { seeing: number; total: number }; v6: { seeing: number; total: number } };
  observedNeighbours: number;
}

export async function routingStatus(asn: number): Promise<RoutingStatus | null> {
  const d = await ripe<{
    announced_space: { v4: { prefixes: number }; v6: { prefixes: number } };
    observed_neighbours: number;
    visibility: { v4: { ris_peers_seeing: number; total_ris_peers: number }; v6: { ris_peers_seeing: number; total_ris_peers: number } };
  }>('routing-status', { resource: `AS${asn}` }, 4000); // slow for large ASNs; better n/a than a stalled panel
  if (!d) return null;
  return {
    announcedV4Prefixes: d.announced_space?.v4?.prefixes ?? 0,
    announcedV6Prefixes: d.announced_space?.v6?.prefixes ?? 0,
    observedNeighbours: d.observed_neighbours ?? 0,
    visibility: {
      v4: { seeing: d.visibility?.v4?.ris_peers_seeing ?? 0, total: d.visibility?.v4?.total_ris_peers ?? 0 },
      v6: { seeing: d.visibility?.v6?.ris_peers_seeing ?? 0, total: d.visibility?.v6?.total_ris_peers ?? 0 },
    },
  };
}

export interface RipeNeighbour {
  asn: number;
  /** left = seen towards the collectors (providers/peers), right = downstream (customers). */
  type: 'left' | 'right' | 'uncertain';
  power: number;
}

export async function asnNeighbours(asn: number): Promise<{ neighbours: RipeNeighbour[]; counts: { left: number; right: number; uncertain: number; unique: number } } | null> {
  const d = await ripe<{
    neighbours: { asn: number; type: 'left' | 'right' | 'uncertain'; power: number }[];
    neighbour_counts: { left: number; right: number; uncertain: number; unique: number };
  }>('asn-neighbours', { resource: `AS${asn}` });
  if (!d) return null;
  return {
    neighbours: (d.neighbours ?? []).map((n) => ({ asn: Number(n.asn), type: n.type, power: Number(n.power) || 0 })),
    counts: d.neighbour_counts ?? { left: 0, right: 0, uncertain: 0, unique: 0 },
  };
}
