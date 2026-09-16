'use strict';

/**
 * IODA source adapter (Internet Outage Detection and Analysis, Georgia Tech).
 *
 * Normalises country-level outage detections into NetEye incidents of type 'outage':
 *   /v2/outages/events  (entityType=country)  -> one event per country and signal, with start,
 *                                                duration and a score
 *   /v2/outages/alerts  (entityType=country)  -> the threshold crossings behind those events,
 *                                                with the observed value and the recent median
 *
 * IODA reports each signal separately (BGP-visible prefixes, active probing, darknet telescope,
 * Google traffic). NetEye merges a country's overlapping events into one incident, and takes the
 * depth of the drop from the alerts: value / historyValue. Severity and confidence are derived
 * from those source numbers with the rules in `severityFor()` and `confidenceFor()`, nothing is
 * estimated. ASN- and region-level detections are not ingested: there are hundreds a day and
 * most are small networks, which would bury the global picture.
 *
 * No key. Responses are cached for IODA_CACHE_TTL_MS (default 60 s) and served stale for up to
 * 15 min when the API is unreachable. Set IODA_DISABLED=1 to switch the source off.
 * Data is (c) Georgia Tech Research Corporation; every incident links back to IODA.
 */

const { placeForCountry, countryName } = require('../geo');

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
const TTL_MS = Number(process.env.IODA_CACHE_TTL_MS || 60_000);
const STALE_MAX_MS = 15 * 60_000;
const TIMEOUT_MS = 12_000;
const MIN_MS = 60_000;
const DAY_MS = 24 * 60 * MIN_MS;
/** IODA includes events that started up to 14 days before the window; look that far back for their alerts. */
const ALERT_LOOKBACK_MS = 15 * DAY_MS;
/** An open event's duration grows with each IODA run (5-minute bins); treat a recent end as ongoing. */
const ONGOING_SLACK_MS = 20 * MIN_MS;
/** Separate events of the same country closer than this are one incident (flapping signal). */
const MERGE_GAP_MS = 60 * MIN_MS;

const id = 'ioda';
const name = 'IODA';
const types = ['outage'];

const SIGNAL_LABEL = { bgp: 'BGP', 'ping-slash24': 'active probing', 'merit-nt': 'darknet telescope', 'ucsd-nt': 'darknet telescope', gtr: 'Google traffic' };
const signalLabel = (ds) => SIGNAL_LABEL[ds] || ds;

const iso = (ms) => new Date(ms).toISOString();

/** @type {Map<string, { at: number, data: any }>} */
const cache = new Map();

async function iodaGet(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const key = url.toString();
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return { data: hit.data, stale: false };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'NetEye (github.com/swamoth/NetEye)' }, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error || !Array.isArray(body.data)) {
      throw new Error(`${path}: ${(body && body.error) || `HTTP ${res.status}`}`);
    }
    cache.set(key, { at: now, data: body.data });
    return { data: body.data, stale: false };
  } catch (err) {
    if (hit && now - hit.at < STALE_MAX_MS) return { data: hit.data, stale: true, error: err };
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Depth = 1 - value / median of the deepest signal, breadth = signals that dropped together.
 * A 75 % loss confirmed by two signals is critical; one signal alone tops out at high.
 */
function severityFor(depth, signals) {
  if (depth >= 0.75 && signals >= 2) return 'critical';
  if (depth >= 0.5 || (depth >= 0.25 && signals >= 2)) return 'high';
  if (depth >= 0.2) return 'medium';
  return 'low';
}

/** More independent signals agreeing, more confidence: 0.6 for one, 0.75 for two, 0.9 for three or more. */
function confidenceFor(signals) {
  return Math.min(0.9, 0.45 + 0.15 * Math.max(1, signals));
}

const pct = (ratio) => Math.round(ratio * 100);

function formatDuration(ms) {
  const m = Math.round(ms / MIN_MS);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/**
 * Merge a country's events (one per signal and episode) into incidents. Events that overlap or
 * sit closer than MERGE_GAP_MS join one incident; the incident carries every signal involved.
 */
function clusterEvents(events) {
  const sorted = events
    .map((e) => ({ start: e.start * 1000, end: (e.start + e.duration) * 1000, datasource: e.datasource, score: Number(e.score) || 0 }))
    .filter((e) => Number.isFinite(e.start) && e.end >= e.start)
    .sort((a, b) => a.start - b.start);
  const clusters = [];
  for (const e of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && e.start <= last.end + MERGE_GAP_MS) {
      last.end = Math.max(last.end, e.end);
      last.signals.add(e.datasource);
      last.score = Math.max(last.score, e.score);
      last.events += 1;
    } else {
      clusters.push({ start: e.start, end: e.end, signals: new Set([e.datasource]), score: e.score, events: 1 });
    }
  }
  return clusters;
}

function mapCountryOutages(events, alerts, now) {
  const byCountry = new Map();
  for (const e of events || []) {
    const m = /^country\/([A-Z]{2})$/i.exec(String(e.location || ''));
    if (!m) continue;
    const cc = m[1].toUpperCase();
    if (!byCountry.has(cc)) byCountry.set(cc, { name: e.location_name, events: [] });
    byCountry.get(cc).events.push(e);
  }
  const alertsByCountry = new Map();
  for (const a of alerts || []) {
    const cc = a && a.entity && a.entity.type === 'country' ? String(a.entity.code).toUpperCase() : null;
    if (!cc) continue;
    if (!alertsByCountry.has(cc)) alertsByCountry.set(cc, []);
    alertsByCountry.get(cc).push(a);
  }

  const out = [];
  for (const [cc, { name: iodaName, events: evs }] of byCountry) {
    const place = placeForCountry(cc);
    if (!place) continue;
    const country = countryName(cc) === cc ? iodaName || cc : countryName(cc);
    const countryAlerts = (alertsByCountry.get(cc) || []).slice().sort((a, b) => a.time - b.time);

    for (const c of clusterEvents(evs)) {
      const ongoing = c.end >= now - ONGOING_SLACK_MS;
      const end = ongoing ? null : c.end;

      // Alerts inside the window: the observed value against the recent median, per signal.
      const inWindow = countryAlerts.filter((a) => a.time * 1000 >= c.start - 5 * MIN_MS && a.time * 1000 <= (end || now) + 5 * MIN_MS);
      const ratioBySignal = new Map();
      const timeline = [];
      for (const a of inWindow) {
        const label = signalLabel(a.datasource);
        const at = iso(a.time * 1000);
        if (a.level === 'critical' && a.historyValue > 0) {
          const ratio = Math.max(0, Math.min(1, a.value / a.historyValue));
          ratioBySignal.set(a.datasource, Math.min(ratioBySignal.get(a.datasource) ?? 1, ratio));
          timeline.push({ at, type: timeline.length ? 'update' : 'detected', message: `${label} at ${pct(ratio)}% of the recent median (${a.value} of ${a.historyValue})` });
        } else if (a.level === 'normal') {
          timeline.push({ at, type: 'update', message: `${label} back to normal (${a.value})` });
        }
      }
      if (!timeline.length) timeline.push({ at: iso(c.start), type: 'detected', message: `IODA outage detection started (${[...c.signals].map(signalLabel).join(', ')})` });
      if (end) timeline.push({ at: iso(end), type: 'resolved', message: 'All signals back within their normal range' });

      const signals = [...c.signals].map(signalLabel);
      const depth = ratioBySignal.size ? 1 - Math.min(...ratioBySignal.values()) : null;
      const severity = severityFor(depth ?? 0, c.signals.size);
      const detail = [...ratioBySignal].map(([ds, r]) => `${signalLabel(ds)} at ${pct(r)}% of normal`).join(', ');
      const titleWord = severity === 'critical' || severity === 'high' ? 'Internet outage' : severity === 'medium' ? 'Connectivity drop' : 'Connectivity dip';

      out.push({
        id: `ioda-${cc}-${Math.floor(c.start / 1000)}`,
        type: 'outage',
        severity,
        status: ongoing ? 'active' : 'resolved',
        title: `${titleWord} in ${country}`,
        description: `IODA sees ${signals.join(' and ')} for ${country} below the recent median${detail ? `: ${detail}` : ''}. ${ongoing ? 'Still below normal.' : `Recovered after ${formatDuration(c.end - c.start)}.`}`,
        location: place,
        affectedASNs: [],
        metrics: { score: Math.round(c.score), signals, ...(depth != null ? { drop: pct(depth) } : {}) },
        source: id,
        sourceName: name,
        confidence: confidenceFor(c.signals.size),
        link: `https://ioda.inetintel.cc.gatech.edu/country/${cc}?from=${Math.floor(c.start / 1000)}&until=${Math.floor((end || now) / 1000)}`,
        startedAt: iso(c.start),
        resolvedAt: end ? iso(end) : undefined,
        updatedAt: iso(end || Math.min(now, c.end)),
        timeline,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter entry point
// ---------------------------------------------------------------------------

let lastPoll = null;

async function fetchIncidents(now = Date.now()) {
  if (process.env.IODA_DISABLED === '1' || process.env.IODA_DISABLED === 'true') {
    return { incidents: [], status: 'disabled', coveredTypes: [], latencyMs: null, lastPoll: null, error: 'IODA_DISABLED is set' };
  }
  const started = Date.now();
  const until = Math.floor(now / 1000);
  const [events, alerts] = await Promise.allSettled([
    iodaGet('/outages/events', { from: Math.floor((now - DAY_MS) / 1000), until, entityType: 'country', limit: 500 }),
    iodaGet('/outages/alerts', { from: Math.floor((now - ALERT_LOOKBACK_MS) / 1000), until, entityType: 'country', limit: 2000 }),
  ]);

  lastPoll = iso(Date.now());
  const errors = [];
  if (events.status === 'rejected') {
    errors.push(events.reason && events.reason.message ? events.reason.message : String(events.reason));
    return { incidents: [], status: 'error', coveredTypes: [], latencyMs: Date.now() - started, lastPoll, error: errors.join('; ') };
  }
  if (alerts.status === 'rejected') errors.push(alerts.reason && alerts.reason.message ? alerts.reason.message : String(alerts.reason));

  let incidents = [];
  try {
    incidents = mapCountryOutages(events.value.data, alerts.status === 'fulfilled' ? alerts.value.data : [], now);
  } catch (err) {
    errors.push(`map outage: ${err.message}`);
  }
  const stale = events.value.stale || (alerts.status === 'fulfilled' && alerts.value.stale);
  return {
    incidents,
    status: errors.length || stale ? 'degraded' : 'ok',
    coveredTypes: ['outage'],
    latencyMs: Date.now() - started,
    lastPoll,
    error: errors.length ? errors.join('; ') : null,
  };
}

module.exports = { id, name, types, fetchIncidents, _internal: { mapCountryOutages, clusterEvents, severityFor, confidenceFor, iodaGet, cache } };
