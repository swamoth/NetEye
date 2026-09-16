'use strict';

/**
 * NetEye incident aggregator — merges live source adapters into one Incident stream.
 *
 * Every incident shown by NetEye comes from a real upstream feed (today: Cloudflare Radar).
 * There is no synthetic or simulated data; when a source is unavailable the affected types are
 * simply absent and /api/health says why.
 *
 * Adapters (server/sources/*) implement:
 *   { id, name, types, fetchIncidents(now) -> { incidents, status, coveredTypes, latencyMs, lastPoll, error } }
 * and must never throw. `createAggregator({ sources })` exists so tests can inject fake adapters;
 * the module-level functions use the default adapter set.
 */

const cloudflareRadar = require('./sources/cloudflareRadar');

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TYPES = ['outage', 'bgp', 'ddos', 'cable_cut'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const iso = (ms) => new Date(ms).toISOString();
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** Status of an incident at time t, or null if it has not started yet. */
function statusAt(inc, t) {
  const start = Date.parse(inc.startedAt);
  if (t < start) return null;
  if (inc.resolvedAt && t >= Date.parse(inc.resolvedAt)) return 'resolved';
  if (inc.mitigatingAt && t >= Date.parse(inc.mitigatingAt)) return 'mitigating';
  return 'active';
}

/**
 * @param {{ sources?: Array<{ id: string, name: string, types: string[], fetchIncidents: (now: number) => Promise<any> }> }} [options]
 */
function createAggregator(options = {}) {
  const sources = options.sources || [cloudflareRadar];

  async function collect(now) {
    const results = await Promise.all(sources.map(async (src) => {
      try {
        return await src.fetchIncidents(now);
      } catch (err) {
        return { incidents: [], status: 'error', coveredTypes: [], latencyMs: null, lastPoll: null, error: String((err && err.message) || err) };
      }
    }));

    const windowStart = now - WINDOW_MS;
    const seen = new Set();
    const incidents = [];
    const statuses = [];

    results.forEach((r, idx) => {
      const src = sources[idx];
      for (const inc of r.incidents || []) {
        // Defensive: adapters already window their data, but never leak future or stale items.
        const start = Date.parse(inc.startedAt);
        const end = inc.resolvedAt ? Date.parse(inc.resolvedAt) : Infinity;
        if (Number.isNaN(start) || start > now || end < windowStart || seen.has(inc.id)) continue;
        seen.add(inc.id);
        incidents.push(inc);
      }
      statuses.push({
        id: src.id,
        name: src.name,
        mode: r.status === 'disabled' ? 'disabled' : 'live',
        status: r.status,
        latencyMs: r.latencyMs == null ? null : r.latencyMs,
        lastPoll: r.lastPoll || null,
        error: r.error || null,
        types: src.types,
        coveredTypes: r.coveredTypes || [],
        count: (r.incidents || []).length,
      });
    });

    incidents.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return { incidents, sources: statuses };
  }

  /** Full 24h snapshot at `now`, newest first. */
  async function getSnapshot(now = Date.now()) {
    const { incidents, sources: statuses } = await collect(now);
    return { now: iso(now), windowMs: WINDOW_MS, incidents, sources: statuses };
  }

  async function getIncident(id, now = Date.now()) {
    const snap = await getSnapshot(now);
    return snap.incidents.find((i) => i.id === id) || null;
  }

  async function getStats(now = Date.now()) {
    const snap = await getSnapshot(now);
    const active = snap.incidents.filter((i) => i.status !== 'resolved');
    const count = (arr, key) => arr.reduce((acc, i) => { const k = key(i); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const asnCounts = new Map();
    for (const i of active) for (const a of i.affectedASNs || []) {
      const cur = asnCounts.get(a.asn) || { asn: a.asn, name: a.name, incidents: 0 };
      cur.incidents += 1;
      asnCounts.set(a.asn, cur);
    }
    const countries = new Set(active.filter((i) => !i.aggregated).map((i) => i.location.countryCode));
    const shares = active.map((i) => i.metrics && i.metrics.sharePct).filter((v) => typeof v === 'number');
    return {
      now: snap.now,
      windowMs: snap.windowMs,
      total: snap.incidents.length,
      active: active.length,
      byStatus: count(snap.incidents, (i) => i.status),
      byType: count(snap.incidents, (i) => i.type),
      activeByType: count(active, (i) => i.type),
      bySeverity: count(snap.incidents, (i) => i.severity),
      byRegion: count(active, (i) => i.location.region),
      countriesAffected: countries.size,
      ddosShareCoveredPct: shares.length ? round(shares.reduce((s, v) => s + v, 0), 1) : null,
      topASNs: [...asnCounts.values()].sort((a, b) => b.incidents - a.incidents).slice(0, 10),
      sources: snap.sources.map((s) => ({ id: s.id, status: s.status, count: s.count })),
    };
  }

  async function getSources(now = Date.now()) {
    return (await getSnapshot(now)).sources;
  }

  return { getSnapshot, getIncident, getStats, getSources, sources };
}

const defaultAggregator = createAggregator();

module.exports = {
  WINDOW_MS,
  TYPES,
  SEVERITIES,
  statusAt,
  createAggregator,
  getSnapshot: defaultAggregator.getSnapshot,
  getIncident: defaultAggregator.getIncident,
  getStats: defaultAggregator.getStats,
  getSources: defaultAggregator.getSources,
};
