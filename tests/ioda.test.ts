import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { Incident } from '../app/utils/types';

const require = createRequire(import.meta.url);
const { _internal, id, name, types } = require('../server/sources/ioda.js');
const { clusterEvents, severityFor, confidenceFor } = _internal;
const mapCountryOutages: (events: unknown[], alerts: unknown[], now: number) => Incident[] = _internal.mapCountryOutages;

// Real IODA v2 responses captured on 2026-09-16 (entityType=country), trimmed.
const NOW = 1789542546 * 1000;
const EVENTS = [
  // Tonga: one BGP event, started 13 days earlier, still running at "now"
  { location: 'country/TO', location_name: 'Tonga', start: 1788422700, duration: 1119940, datasource: 'bgp', score: 22763.008, method: 'median', status: 0, overlaps_window: true },
  // Cape Verde: a flapping active-probing signal, four episodes
  { location: 'country/CV', location_name: 'Cape Verde', start: 1789441800, duration: 15000, datasource: 'ping-slash24', score: 5844.15, method: 'median', status: 0, overlaps_window: true },
  { location: 'country/CV', location_name: 'Cape Verde', start: 1789457400, duration: 10200, datasource: 'ping-slash24', score: 3642.85, method: 'median', status: 0, overlaps_window: false },
  { location: 'country/CV', location_name: 'Cape Verde', start: 1789468800, duration: 20400, datasource: 'ping-slash24', score: 8168.83, method: 'median', status: 0, overlaps_window: false },
  { location: 'country/CV', location_name: 'Cape Verde', start: 1789491600, duration: 51040, datasource: 'ping-slash24', score: 21542.85, method: 'median', status: 0, overlaps_window: true },
  // Macedonia: a 30-minute 1 % BGP dip, resolved
  { location: 'country/MK', location_name: 'Macedonia', start: 1789458600, duration: 1800, datasource: 'bgp', score: 40.04, method: 'median', status: 0, overlaps_window: false },
  // Hong Kong: three ten-minute telescope dips of 75 %, resolved
  { location: 'country/HK', location_name: 'Hong Kong', start: 1789520280, duration: 600, datasource: 'merit-nt', score: 766.74, method: 'median', status: 0, overlaps_window: false },
  { location: 'country/HK', location_name: 'Hong Kong', start: 1789521300, duration: 540, datasource: 'merit-nt', score: 692.14, method: 'median', status: 0, overlaps_window: false },
  { location: 'country/HK', location_name: 'Hong Kong', start: 1789523220, duration: 540, datasource: 'merit-nt', score: 690.06, method: 'median', status: 0, overlaps_window: false },
  // Not a country: must be ignored
  { location: 'asn/41809', location_name: 'AS41809 (ENTERPOL-AS)', start: 1788314400, duration: 1228240, datasource: 'bgp', score: 2047066, method: 'median', status: 0, overlaps_window: true },
];
const alert = (code: string, nm: string, datasource: string, time: number, level: string, condition: string, value: number, historyValue: number) =>
  ({ datasource, entity: { code, name: nm, type: 'country', subnames: [], attrs: {} }, time, level, condition, value, historyValue, method: 'median' });
const ALERTS = [
  alert('CV', 'Cape Verde', 'ping-slash24', 1789456800, 'normal', 'normal', 126, 154),
  alert('CV', 'Cape Verde', 'ping-slash24', 1789457400, 'critical', '< 0.8', 121, 154),
  alert('CV', 'Cape Verde', 'ping-slash24', 1789467600, 'normal', 'normal', 124, 154),
  alert('CV', 'Cape Verde', 'ping-slash24', 1789468800, 'critical', '< 0.8', 117, 154),
  alert('CV', 'Cape Verde', 'ping-slash24', 1789489200, 'normal', 'normal', 125, 154),
  alert('CV', 'Cape Verde', 'ping-slash24', 1789491600, 'critical', '< 0.8', 115, 154),
  alert('MK', 'Macedonia', 'bgp', 1789458600, 'critical', '< 0.99', 2661, 2697),
  alert('MK', 'Macedonia', 'bgp', 1789460400, 'normal', 'normal', 2697, 2697),
  alert('HK', 'Hong Kong', 'merit-nt', 1789520280, 'critical', '< 0.25', 101, 433),
  alert('HK', 'Hong Kong', 'merit-nt', 1789520880, 'normal', 'normal', 319, 433),
  alert('HK', 'Hong Kong', 'merit-nt', 1789521300, 'critical', '< 0.25', 100, 433),
  alert('HK', 'Hong Kong', 'merit-nt', 1789521840, 'normal', 'normal', 207, 433),
  alert('HK', 'Hong Kong', 'merit-nt', 1789523220, 'critical', '< 0.25', 101, 433),
  alert('HK', 'Hong Kong', 'merit-nt', 1789523760, 'normal', 'normal', 110, 433),
];

describe('IODA adapter', () => {
  it('declares the adapter contract', () => {
    expect(id).toBe('ioda');
    expect(name).toBe('IODA');
    expect(types).toEqual(['outage']);
  });

  it('merges a country\'s episodes that sit within an hour and keeps the rest apart', () => {
    const cv = clusterEvents(EVENTS.filter((e) => e.location === 'country/CV'));
    // 1789441800+15000 = 1789456800, next starts 1789457400 (10 min later): merged.
    // 1789467600 -> 1789468800 (20 min): merged. 1789489200 -> 1789491600 (40 min): merged too.
    expect(cv).toHaveLength(1);
    expect(cv[0].events).toBe(4);
    expect([...cv[0].signals]).toEqual(['ping-slash24']);
    const hk = clusterEvents(EVENTS.filter((e) => e.location === 'country/HK'));
    expect(hk).toHaveLength(1); // three dips minutes apart
    expect(hk[0].events).toBe(3);
  });

  it('maps country events to outage incidents and ignores ASN rows', () => {
    const out = mapCountryOutages(EVENTS, ALERTS, NOW);
    const codes = out.map((i) => i.location.countryCode).sort();
    expect(codes).toEqual(['CV', 'HK', 'MK', 'TO']);
    for (const inc of out) {
      expect(inc.type).toBe('outage');
      expect(inc.source).toBe('ioda');
      expect(inc.link).toMatch(/^https:\/\/ioda\.inetintel\.cc\.gatech\.edu\/country\//);
      expect(inc.title).not.toMatch(/—/); // no em dash in UI copy
    }
  });

  it('keeps a long-running detection active and resolves finished ones', () => {
    const out = mapCountryOutages(EVENTS, ALERTS, NOW);
    const tonga = out.find((i) => i.location.countryCode === 'TO')!;
    expect(tonga.status).toBe('active');
    expect(tonga.resolvedAt).toBeUndefined();
    expect(tonga.startedAt).toBe(new Date(1788422700 * 1000).toISOString());
    const mk = out.find((i) => i.location.countryCode === 'MK')!;
    expect(mk.status).toBe('resolved');
    expect(mk.resolvedAt).toBe(new Date((1789458600 + 1800) * 1000).toISOString());
  });

  it('takes the depth of the drop from the alerts and derives severity from depth and breadth', () => {
    const out = mapCountryOutages(EVENTS, ALERTS, NOW);
    const hk = out.find((i) => i.location.countryCode === 'HK')!;
    expect(hk.metrics.drop).toBe(77); // 100 of 433 = 23 % of normal
    expect(hk.severity).toBe('high'); // deep, but one signal only
    expect(hk.metrics.signals).toEqual(['darknet telescope']);
    const cv = out.find((i) => i.location.countryCode === 'CV')!;
    expect(cv.metrics.drop).toBe(25); // 115 of 154
    expect(cv.severity).toBe('medium');
    expect(cv.status).toBe('active'); // last episode ends at "now"
    const mk = out.find((i) => i.location.countryCode === 'MK')!;
    expect(mk.severity).toBe('low');
    expect(mk.title).toBe('Connectivity dip in North Macedonia');
    expect(severityFor(0.8, 2)).toBe('critical');
    expect(severityFor(0.8, 1)).toBe('high');
    expect(severityFor(0.3, 2)).toBe('high');
    expect(severityFor(0.3, 1)).toBe('medium');
    expect(confidenceFor(1)).toBeCloseTo(0.6, 9);
    expect(confidenceFor(3)).toBeCloseTo(0.9, 9);
  });

  it('writes a timeline from the alert transitions', () => {
    const out = mapCountryOutages(EVENTS, ALERTS, NOW);
    const hk = out.find((i) => i.location.countryCode === 'HK')!;
    expect(hk.timeline[0]).toMatchObject({ type: 'detected' });
    expect(hk.timeline[0].message).toContain('darknet telescope at 23% of the recent median');
    expect(hk.timeline.some((e) => e.message.includes('back to normal'))).toBe(true);
    expect(hk.timeline[hk.timeline.length - 1].type).toBe('resolved');
  });
});
