import { describe, expect, it } from 'vitest';
import type { Incident } from '../app/utils/types';
import { applyUpdate, filterIncidents, histogram, isVisibleAt, matchesQuery, RESOLVED_LINGER_MS, sortIncidents, statusAt, summarize } from '../app/utils/incidents';
import { toCsv } from '../app/utils/export';
import { readUrlState, serializeUrlState } from '../app/hooks/useUrlState';

const T0 = Date.UTC(2026, 8, 11, 10, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

function make(over: Partial<Incident> & { id: string }): Incident {
  return {
    type: 'outage',
    severity: 'medium',
    status: 'active',
    title: 'Regional connectivity outage in Mumbai, India',
    description: 'desc',
    location: { lat: 19.07, lng: 72.87, city: 'Mumbai', country: 'India', countryCode: 'IN', region: 'South Asia' },
    affectedASNs: [{ asn: 55836, name: 'Reliance Jio', role: 'origin' }],
    metrics: { prefixes: 3 },
    source: 'cloudflare_radar',
    sourceName: 'Cloudflare Radar',
    confidence: 0.9,
    startedAt: iso(T0),
    updatedAt: iso(T0),
    timeline: [],
    ...over,
  };
}

describe('statusAt / visibility', () => {
  const inc = make({ id: 'a', mitigatingAt: iso(T0 + 60 * 60e3), resolvedAt: iso(T0 + 120 * 60e3) });
  it('walks through the lifecycle', () => {
    expect(statusAt(inc, T0 - 1)).toBeNull();
    expect(statusAt(inc, T0)).toBe('active');
    expect(statusAt(inc, T0 + 61 * 60e3)).toBe('mitigating');
    expect(statusAt(inc, T0 + 121 * 60e3)).toBe('resolved');
  });
  it('lingers on the globe briefly after resolution', () => {
    const resolvedAt = T0 + 120 * 60e3;
    expect(isVisibleAt(inc, resolvedAt + RESOLVED_LINGER_MS - 1)).toBe(true);
    expect(isVisibleAt(inc, resolvedAt + RESOLVED_LINGER_MS + 1)).toBe(false);
    expect(isVisibleAt(inc, T0 - 1)).toBe(false);
  });
});

describe('filtering, sorting, summarising', () => {
  const list = [
    make({ id: 'crit', severity: 'critical', type: 'bgp', startedAt: iso(T0 - 10e3), affectedASNs: [{ asn: 13335, name: 'Cloudflare', role: 'victim' }] }),
    make({ id: 'low', severity: 'low', startedAt: iso(T0 - 5e3) }),
    make({ id: 'done', severity: 'high', status: 'resolved', resolvedAt: iso(T0 - 1e3), startedAt: iso(T0 - 3600e3) }),
    make({
      id: 'cable',
      type: 'cable_cut',
      location: { lat: 0, lng: 60, country: 'International waters', countryCode: 'XX', region: 'Africa' },
      cable: { id: 'smw5', name: 'SEA-ME-WE 5', lengthKm: 1, capacityTbps: 1, owners: 'x', rfs: 2016, landings: [], faultIndex: 0, kmFromLanding: 1 },
    }),
  ];

  it('filters by type, severity, status, asn and text', () => {
    expect(filterIncidents(list, { types: ['bgp'] }).map((i) => i.id)).toEqual(['crit']);
    expect(filterIncidents(list, { severities: new Set(['low', 'high']) }).map((i) => i.id)).toEqual(['low', 'done']);
    expect(filterIncidents(list, { statuses: ['resolved'] }).map((i) => i.id)).toEqual(['done']);
    expect(filterIncidents(list, { asn: 13335 }).map((i) => i.id)).toEqual(['crit']);
    expect(filterIncidents(list, { q: 'sea-me-we' }).map((i) => i.id)).toEqual(['cable']);
    expect(filterIncidents(list, { q: 'AS13335' }).map((i) => i.id)).toEqual(['crit']);
    expect(filterIncidents(list, { since: T0 - 500 }).map((i) => i.id)).toEqual(['crit', 'low', 'cable']);
  });

  it('matches multi-word queries against all words', () => {
    expect(matchesQuery(list[0], 'mumbai bgp')).toBe(true);
    expect(matchesQuery(list[0], 'mumbai cable')).toBe(false);
  });

  it('sorts active before resolved, then by severity, then recency', () => {
    expect(sortIncidents(list, T0).map((i) => i.id)).toEqual(['crit', 'cable', 'low', 'done']);
  });

  it('summarises KPIs at a point in time with counts only', () => {
    const s = summarize(list, T0);
    expect(s.active).toBe(3);
    expect(s.resolved).toBe(1);
    expect(s.critical).toBe(1);
    expect(s.high).toBe(0); // the only high one is resolved
    expect(s.activeByType.bgp).toBe(1);
    expect(s.countries).toBe(2); // IN and the cable's XX
    expect(s.asns).toBe(2); // 55836 and 13335
    expect(s.ddosSharePct).toBeNull();
  });

  it('bins a histogram and skips aggregates', () => {
    const bins = histogram([...list, make({ id: 'agg', aggregated: true, startedAt: iso(T0 - 100) })], T0 - 3600e3, T0 + 1, 4);
    const total = bins.reduce((s, b) => s + b.outage + b.bgp + b.ddos + b.cable_cut, 0);
    expect(total).toBe(4);
    expect(bins[0].outage).toBe(1); // 'done' started at the window start
  });

  it('applies websocket diffs', () => {
    const prev = new Map(list.map((i) => [i.id, i]));
    const next = applyUpdate(prev, [make({ id: 'new' })], [make({ id: 'low', severity: 'high' })], ['done']);
    expect(next.has('done')).toBe(false);
    expect(next.get('new')).toBeDefined();
    expect(next.get('low')!.severity).toBe('high');
    expect(prev.get('low')!.severity).toBe('low'); // immutable
  });

  it('exports RFC 4180 CSV', () => {
    const csv = toCsv([make({ id: 'q', title: 'Has, comma and "quotes"' })]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('id,type,severity')).toBe(true);
    expect(lines[1]).toContain('"Has, comma and ""quotes"""');
  });
});

describe('url state', () => {
  it('round-trips', () => {
    const s = {
      incident: 'cf-hj-1-2',
      types: ['bgp', 'ddos'] as ('bgp' | 'ddos')[],
      sev: ['critical'] as ['critical'],
      q: 'mumbai',
      t: T0,
      pov: { lat: 10.123, lng: -20.456, altitude: 1.5 },
      asn: null,
    };
    const qs = serializeUrlState(s);
    expect(qs).toContain('incident=cf-hj-1-2');
    const back = readUrlState(qs);
    expect(back.incident).toBe('cf-hj-1-2');
    expect(back.types).toEqual(['bgp', 'ddos']);
    expect(back.sev).toEqual(['critical']);
    expect(back.q).toBe('mumbai');
    expect(back.t).toBe(T0);
    expect(back.pov).toEqual({ lat: 10.12, lng: -20.46, altitude: 1.5 });
  });
  it('drops all-types filters and future times', () => {
    expect(serializeUrlState({ incident: null, types: ['outage', 'bgp', 'ddos', 'cable_cut'], sev: null, q: '', t: null, pov: null, asn: null })).toBe('');
    expect(readUrlState(`?t=${Date.now() + 60_000}`).t).toBeNull();
  });
});
