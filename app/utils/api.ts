import type { HealthReport, Incident, Snapshot, Stats, WhoAmI } from './types';

/** Typed fetch wrappers for the NetEye REST API (browser side). */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* not json */ }
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface OutagesQuery {
  type?: string;
  severity?: string;
  status?: string;
  since?: string;
  q?: string;
  limit?: number;
}

export function fetchOutages(query: OutagesQuery = {}, init?: RequestInit): Promise<Snapshot> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v != null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return getJson<Snapshot>(`/api/outages${qs ? `?${qs}` : ''}`, init);
}

export function fetchIncident(id: string, init?: RequestInit): Promise<Incident> {
  return getJson<Incident>(`/api/outages/${encodeURIComponent(id)}`, init);
}

export function fetchStats(init?: RequestInit): Promise<Stats> {
  return getJson<Stats>('/api/stats', init);
}

export function fetchHealth(init?: RequestInit): Promise<HealthReport> {
  return getJson<HealthReport>('/api/health', init);
}

export function fetchWhoAmI(init?: RequestInit): Promise<WhoAmI> {
  return getJson<WhoAmI>('/api/whoami', { cache: 'no-store', ...init });
}

/** WebSocket URL: env override, else same host on port 3001. */
export function websocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === 'undefined') return 'ws://localhost:3001';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.hostname}:3001`;
}
