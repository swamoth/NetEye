'use strict';

/**
 * Cloudflare Radar source adapter.
 *
 * Normalises four Radar endpoints into NetEye incidents:
 *   /radar/annotations/outages          -> type 'outage'
 *   /radar/bgp/hijacks/events           -> type 'bgp'
 *   /radar/bgp/leaks/events             -> type 'bgp'
 *   /radar/attacks/layer3/top/attacks   -> type 'ddos' (aggregated origin -> target pairs)
 *
 * Requires CLOUDFLARE_API_TOKEN (Account > Radar > Read). Responses are cached in memory for
 * RADAR_CACHE_TTL_MS (default 60 s) and served stale for up to 15 min if the API is unreachable,
 * so a flaky upstream never blanks the globe. Never throws from fetchIncidents().
 *
 * Adapter contract (see docs/architecture.md):
 *   { id, name, types, fetchIncidents(now) -> Promise<{ incidents, status, coveredTypes, latencyMs, lastPoll, error }> }
 */

const { geolocate, placeForCountry, countryName } = require('../geo');

const BASE = 'https://api.cloudflare.com/client/v4/radar';
const TTL_MS = Number(process.env.RADAR_CACHE_TTL_MS || 60_000);
const STALE_MAX_MS = 15 * 60_000;
const TIMEOUT_MS = 8_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const id = 'cloudflare_radar';
const name = 'Cloudflare Radar';
const types = ['outage', 'bgp', 'ddos'];

const iso = (ms) => new Date(ms).toISOString();
const token = () => process.env.CLOUDFLARE_API_TOKEN || '';

/** @type {Map<string, { at: number, data: any }>} */
const cache = new Map();

async function radarGet(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const key = url.toString();
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return { data: hit.data, stale: false };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.success === false) {
      const msg = body && Array.isArray(body.errors) && body.errors[0] ? body.errors[0].message : `HTTP ${res.status}`;
      throw new Error(`${path}: ${msg}`);
    }
    cache.set(key, { at: now, data: body.result });
    return { data: body.result, stale: false };
  } catch (err) {
    if (hit && now - hit.at < STALE_MAX_MS) return { data: hit.data, stale: true, error: err };
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const point = (p) => ({ lat: p.lat, lng: p.lng, name: p.city || p.country, countryCode: p.countryCode });

const SCOPE_LABEL = { NATIONWIDE: 'Nationwide', REGIONAL: 'Regional', NETWORK: 'Network-level', PLATFORM: 'Platform' };
const CAUSE_LABEL = {
  CABLE_CUT: 'cable cut', CYBER_ATTACK: 'cyber attack', GOVERNMENT_DIRECTED: 'government-directed shutdown',
  MILITARY_ACTION: 'military action', POWER_OUTAGE: 'power outage', TECHNICAL_PROBLEM: 'technical problem',
  WEATHER: 'severe weather', NATURAL_DISASTER: 'natural disaster', UNKNOWN: 'unknown cause',
};

function outageSeverity(scope, cause) {
  let sev = scope === 'NATIONWIDE' ? 'critical' : scope === 'REGIONAL' ? 'high' : 'medium';
  if ((cause === 'GOVERNMENT_DIRECTED' || cause === 'MILITARY_ACTION') && sev === 'medium') sev = 'high';
  return sev;
}

function mapOutages(result, now) {
  const list = (result && result.annotations) || [];
  const windowStart = now - DAY_MS;
  const out = [];
  for (const a of list) {
    const start = Date.parse(a.startDate);
    const end = a.endDate ? Date.parse(a.endDate) : null;
    if (Number.isNaN(start) || start > now) continue;
    if (end && end < windowStart) continue;

    const asns = (a.asns || []).map(Number).filter(Number.isFinite);
    const cc = (a.locations && a.locations[0]) || (a.asnsDetails && a.asnsDetails[0] && a.asnsDetails[0].locations && a.asnsDetails[0].locations.code) || null;
    const place = geolocate(cc, asns);
    if (!place) continue;

    const scope = String((a.outage && a.outage.outageType) || '').toUpperCase();
    const cause = String((a.outage && a.outage.outageCause) || 'UNKNOWN').toUpperCase();
    const countries = (a.locationsDetails || []).map((l) => l.name).filter(Boolean);
    const where = countries.length ? countries.join(', ') : place.country;
    const resolved = Boolean(end && end <= now);
    const affectedASNs = (a.asnsDetails || []).map((d) => ({ asn: Number(d.asn), name: d.name || `AS${d.asn}`, role: 'origin' }));

    const timeline = [{ at: iso(start), type: 'detected', message: `Cloudflare Radar: ${SCOPE_LABEL[scope] || 'Internet'} outage detected. Cause: ${CAUSE_LABEL[cause] || cause.toLowerCase()}` }];
    if (resolved) timeline.push({ at: iso(end), type: 'resolved', message: 'Traffic recovered to expected levels' });

    out.push({
      id: `cf-out-${a.id}`,
      type: 'outage',
      severity: outageSeverity(scope, cause),
      status: resolved ? 'resolved' : 'active',
      title: `${SCOPE_LABEL[scope] || 'Internet'} outage in ${where}`,
      description: a.description || `Cloudflare Radar observed a significant traffic drop in ${where}.`,
      cause,
      location: place,
      affectedASNs,
      metrics: {},
      source: id,
      sourceName: name,
      confidence: 0.9,
      link: a.linkedUrl || 'https://radar.cloudflare.com/outage-center',
      startedAt: iso(start),
      resolvedAt: resolved ? iso(end) : undefined,
      updatedAt: iso(resolved ? end : start),
      timeline,
    });
  }
  return out;
}

/** Radar BGP timestamps come without a timezone suffix; they are UTC. */
function parseUtc(s) {
  if (!s) return NaN;
  const str = String(s);
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(str) ? str : str + 'Z');
}

/** `result.asn_info` is a top-level lookup table shared by all events in the response. */
function asnInfoMap(result) {
  const m = new Map();
  for (const x of (result && result.asn_info) || []) m.set(Number(x.asn), x);
  return m;
}
const orgName = (info, asn) => (info.get(Number(asn)) && info.get(Number(asn)).org_name) || null;
const asnLabel = (info, asn) => { const n = orgName(info, asn); return n ? `AS${asn} ${n}` : `AS${asn}`; };
const asnCountry = (info, asn) => (info.get(Number(asn)) && info.get(Number(asn)).country_code) || null;

function hijackSeverity(conf, peers) {
  if (conf >= 10 && peers >= 5) return 'critical';
  if (conf >= 8) return 'high';
  if (conf >= 5) return 'medium';
  return 'low';
}

/**
 * Radar emits one event per detection; the same hijacker→victim pair often repeats within a day.
 * Collapse to one incident per pair so the globe shows anomalies, not log lines.
 */
function mapHijacks(result, now) {
  const events = (result && result.events) || [];
  const info = asnInfoMap(result);
  const groups = new Map();
  for (const e of events) {
    const start = parseUtc(e.min_hijack_ts);
    if (Number.isNaN(start) || start > now) continue;
    const victim = Number((e.victim_asns || [])[0]);
    const hijacker = Number(e.hijacker_asn);
    if (!Number.isFinite(victim) || !Number.isFinite(hijacker)) continue;
    const key = `${hijacker}>${victim}`;
    const end = Math.max(parseUtc(e.max_hijack_ts) || start, parseUtc(e.max_msg_ts) || start);
    let g = groups.get(key);
    if (!g) {
      g = { hijacker, victim, start, end, ongoing: false, conf: 0, peers: 0, msgs: 0, prefixes: new Set(), events: 0, vCC: null, hCC: null, ids: [] };
      groups.set(key, g);
    }
    g.start = Math.min(g.start, start);
    g.end = Math.max(g.end, end);
    g.ongoing = g.ongoing || Number(e.on_going_count || 0) > 0;
    g.conf = Math.max(g.conf, Number(e.confidence_score || 0));
    g.peers = Math.max(g.peers, Number(e.peer_ip_count || 0));
    g.msgs += Number(e.hijack_msgs_count || 0);
    for (const p of e.prefixes || []) g.prefixes.add(p);
    g.events += 1;
    g.vCC = g.vCC || (e.victim_countries || [])[0] || asnCountry(info, victim);
    g.hCC = g.hCC || e.hijacker_country || asnCountry(info, hijacker);
    g.ids.push(e.id);
  }

  const out = [];
  for (const g of groups.values()) {
    const place = geolocate(g.vCC, [g.victim]) || geolocate(g.hCC, [g.hijacker]);
    if (!place) continue;
    const origin = geolocate(g.hCC, [g.hijacker]);
    const resolved = !g.ongoing && now - g.end > 10 * 60_000;
    const prefixes = [...g.prefixes];
    const vName = orgName(info, g.victim) || `AS${g.victim}`;
    const hName = orgName(info, g.hijacker) || `AS${g.hijacker}`;
    const timeline = [{ at: iso(g.start), type: 'detected', message: `RIS peers saw AS${g.hijacker} originating address space of AS${g.victim} (confidence ${g.conf}/12)` }];
    if (g.events > 1) timeline.push({ at: iso(g.end), type: 'update', message: `${g.events} detections for this pair in the last 24 h` });
    if (resolved) timeline.push({ at: iso(g.end), type: 'resolved', message: 'No further anomalous announcements observed' });

    out.push({
      id: `cf-hj-${g.hijacker}-${g.victim}`,
      type: 'bgp',
      severity: hijackSeverity(g.conf, g.peers),
      status: resolved ? 'resolved' : 'active',
      title: `Possible prefix hijack: ${asnLabel(info, g.hijacker)} → ${asnLabel(info, g.victim)}`,
      description: `${prefixes.length} prefix${prefixes.length === 1 ? '' : 'es'} normally originated by AS${g.victim} (${vName}) were announced by AS${g.hijacker} (${hName}). Seen by ${g.peers} RIS peer${g.peers === 1 ? '' : 's'} across ${g.msgs} BGP message${g.msgs === 1 ? '' : 's'} in ${g.events} detection${g.events === 1 ? '' : 's'}; confidence ${g.conf}/12.${prefixes.length ? ` Prefixes: ${prefixes.slice(0, 4).join(', ')}${prefixes.length > 4 ? ` +${prefixes.length - 4} more` : ''}.` : ''}`,
      cause: 'PREFIX_HIJACK',
      location: place,
      path: origin && (origin.lat !== place.lat || origin.lng !== place.lng)
        ? [{ from: point(origin), to: point(place), kind: 'reroute', label: `AS${g.hijacker} → AS${g.victim}` }]
        : undefined,
      affectedASNs: [
        { asn: g.victim, name: vName, role: 'victim' },
        { asn: g.hijacker, name: hName, role: 'hijacker' },
      ],
      metrics: { prefixes: prefixes.length, confidence: g.conf, events: g.events, peers: g.peers },
      source: id,
      sourceName: name,
      confidence: Math.min(0.99, Math.max(0.3, g.conf / 12)),
      link: `https://radar.cloudflare.com/routing/as${g.victim}`,
      startedAt: iso(g.start),
      resolvedAt: resolved ? iso(g.end) : undefined,
      updatedAt: iso(g.end),
      timeline,
    });
  }
  return out;
}

/** One incident per leaking ASN (events repeat as the leak flaps). */
function mapLeaks(result, now) {
  const events = (result && result.events) || [];
  const info = asnInfoMap(result);
  const groups = new Map();
  for (const e of events) {
    const start = parseUtc(e.min_ts || e.detected_ts);
    if (Number.isNaN(start) || start > now) continue;
    const leaker = Number(e.leak_asn);
    if (!Number.isFinite(leaker)) continue;
    const end = parseUtc(e.max_ts) || start;
    let g = groups.get(leaker);
    if (!g) {
      g = { leaker, start, end, finished: true, prefixes: 0, origins: 0, peers: 0, leaks: 0, events: 0, seg: [], countries: [], ids: [] };
      groups.set(leaker, g);
    }
    g.start = Math.min(g.start, start);
    if (end >= g.end) { g.end = end; g.seg = (e.leak_seg || []).map(Number); }
    g.finished = g.finished && e.finished !== false;
    g.prefixes += Number(e.prefix_count || 0);
    g.origins = Math.max(g.origins, Number(e.origin_count || 0));
    g.peers = Math.max(g.peers, Number(e.peer_count || 0));
    g.leaks += Number(e.leak_count || 0);
    g.events += 1;
    for (const cc of e.countries || []) if (cc && !g.countries.includes(cc)) g.countries.push(cc);
    g.ids.push(e.id);
  }

  const out = [];
  for (const g of groups.values()) {
    const lCC = asnCountry(info, g.leaker) || g.countries[0];
    const place = geolocate(lCC, [g.leaker]);
    if (!place) continue;
    const severity = g.prefixes >= 1000 ? 'critical' : g.prefixes >= 200 ? 'high' : g.prefixes >= 30 ? 'medium' : 'low';
    const resolved = g.finished && now - g.end > 10 * 60_000;
    const lName = orgName(info, g.leaker) || `AS${g.leaker}`;

    // Arc from the leaker to the first upstream in the leak segment we can place.
    let path;
    for (const asn of g.seg) {
      if (asn === g.leaker) continue;
      const p = geolocate(asnCountry(info, asn), [asn]);
      if (p && (p.lat !== place.lat || p.lng !== place.lng)) { path = [{ from: point(place), to: point(p), kind: 'reroute', label: `AS${g.leaker} → AS${asn}` }]; break; }
    }

    const timeline = [{ at: iso(g.start), type: 'detected', message: `Route leak detected: AS${g.leaker} re-announced routes learned from a peer/provider` }];
    if (g.events > 1) timeline.push({ at: iso(g.end), type: 'update', message: `${g.events} leak events in the last 24 h (${g.prefixes} prefixes total)` });
    if (resolved) timeline.push({ at: iso(g.end), type: 'resolved', message: 'Leaked routes withdrawn' });

    out.push({
      id: `cf-leak-${g.leaker}`,
      type: 'bgp',
      severity,
      status: resolved ? 'resolved' : 'active',
      title: `Route leak by ${asnLabel(info, g.leaker)}, ${g.prefixes} prefix${g.prefixes === 1 ? '' : 'es'}`,
      description: `AS${g.leaker} (${lName}) leaked ${g.prefixes} prefixes from ${g.origins || '?'} origin ASN${g.origins === 1 ? '' : 's'} to ${g.peers || '?'} peers across ${g.events} event${g.events === 1 ? '' : 's'} (${g.leaks} leak announcements).${g.seg.length ? ` Latest leak path: ${g.seg.map((a) => `AS${a}`).join(' → ')}.` : ''}`,
      cause: 'ROUTE_LEAK',
      location: place,
      path,
      affectedASNs: [
        { asn: g.leaker, name: lName, role: 'leaker' },
        ...g.seg.filter((a) => a !== g.leaker).slice(0, 3).map((a) => ({ asn: a, name: orgName(info, a) || `AS${a}`, role: 'upstream' })),
      ],
      metrics: { prefixes: g.prefixes, events: g.events, peers: g.peers },
      source: id,
      sourceName: name,
      confidence: 0.85,
      link: `https://radar.cloudflare.com/routing/as${g.leaker}`,
      startedAt: iso(g.start),
      resolvedAt: resolved ? iso(g.end) : undefined,
      updatedAt: iso(g.end),
      timeline,
    });
  }
  return out;
}

function mapAttacks(result, now) {
  const top = (result && (result.top_0 || result.top)) || [];
  const windowStart = Math.floor(now / 3_600_000) * 3_600_000 - DAY_MS;
  const out = [];
  for (const t of top) {
    const oCC = t.originCountryAlpha2;
    const tCC = t.targetCountryAlpha2;
    const origin = placeForCountry(oCC);
    const target = placeForCountry(tCC);
    if (!origin || !target) continue;
    const share = Number(t.value);
    if (!Number.isFinite(share)) continue;
    const severity = share >= 8 ? 'critical' : share >= 4 ? 'high' : share >= 1.5 ? 'medium' : 'low';
    const oName = t.originCountryName || countryName(oCC);
    const tName = t.targetCountryName || countryName(tCC);
    out.push({
      id: `cf-ddos-${oCC}-${tCC}`.toLowerCase(),
      type: 'ddos',
      severity,
      status: 'active',
      title: `L3 DDoS traffic ${oName} → ${tName}`,
      description: `${share.toFixed(1)}% of all layer-3 DDoS bytes mitigated by Cloudflare in the trailing 24 h targeted ${tName} from sources in ${oName}. Aggregated statistic from Cloudflare Radar, not a single attack.`,
      cause: 'L3_DDOS',
      location: target,
      path: [{ from: point(origin), to: point(target), kind: 'attack', label: `${oName} → ${tName}` }],
      affectedASNs: [],
      metrics: { sharePct: share },
      source: id,
      sourceName: name,
      aggregated: true,
      confidence: 0.95,
      link: 'https://radar.cloudflare.com/security-and-attacks',
      startedAt: iso(windowStart),
      updatedAt: iso(Math.floor(now / 3_600_000) * 3_600_000),
      timeline: [{ at: iso(windowStart), type: 'detected', message: 'Aggregated over the trailing 24 h window (Cloudflare Radar, mitigated bytes)' }],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter entry point
// ---------------------------------------------------------------------------

let lastPoll = null;

async function fetchIncidents(now = Date.now()) {
  if (!token()) {
    return { incidents: [], status: 'disabled', coveredTypes: [], latencyMs: null, lastPoll: null, error: 'CLOUDFLARE_API_TOKEN not set' };
  }
  const started = Date.now();
  const calls = [
    ['outage', () => radarGet('/annotations/outages', { dateRange: '7d', limit: 100 }), mapOutages],
    ['bgp', () => radarGet('/bgp/hijacks/events', { dateRange: '1d', per_page: 50, sortBy: 'TIME', sortOrder: 'DESC', minConfidence: 4 }), mapHijacks],
    ['bgp', () => radarGet('/bgp/leaks/events', { dateRange: '1d', per_page: 30, sortBy: 'TIME', sortOrder: 'DESC' }), mapLeaks],
    ['ddos', () => radarGet('/attacks/layer3/top/attacks', { dateRange: '1d', limit: 15, limitDirection: 'TARGET', limitPerLocation: 2, magnitude: 'MITIGATED_BYTES' }), mapAttacks],
  ];
  const settled = await Promise.allSettled(calls.map(([, call]) => call()));

  const incidents = [];
  const covered = new Set();
  const errors = [];
  let stale = false;
  settled.forEach((r, i) => {
    const [type, , map] = calls[i];
    if (r.status === 'fulfilled') {
      try {
        incidents.push(...map(r.value.data, now));
        covered.add(type);
        if (r.value.stale) stale = true;
      } catch (err) {
        errors.push(`map ${type}: ${err.message}`);
      }
    } else {
      errors.push(r.reason && r.reason.message ? r.reason.message : String(r.reason));
    }
  });

  lastPoll = iso(Date.now());
  const status = errors.length === calls.length ? 'error' : errors.length || stale ? 'degraded' : 'ok';
  return {
    incidents,
    status,
    coveredTypes: [...covered],
    latencyMs: Date.now() - started,
    lastPoll,
    error: errors.length ? errors.join('; ') : null,
  };
}

module.exports = { id, name, types, fetchIncidents, _internal: { mapOutages, mapHijacks, mapLeaks, mapAttacks, radarGet, cache } };
