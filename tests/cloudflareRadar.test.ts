import { describe, expect, it } from 'vitest';

/**
 * Mapper tests for the Cloudflare Radar adapter. Fixtures mirror the shapes observed from the
 * live API (Sept 2026): top-level `asn_info` lookup tables, BGP timestamps without a timezone
 * suffix, `top_0` for attack pairs, `annotations` for outages.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const radar = require('../server/sources/cloudflareRadar') as {
  _internal: {
    mapOutages: (result: unknown, now: number) => import('../app/utils/types').Incident[];
    mapHijacks: (result: unknown, now: number) => import('../app/utils/types').Incident[];
    mapLeaks: (result: unknown, now: number) => import('../app/utils/types').Incident[];
    mapAttacks: (result: unknown, now: number) => import('../app/utils/types').Incident[];
  };
};

const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);

describe('Radar outage annotations', () => {
  const fixture = {
    annotations: [
      {
        id: '1667', dataSource: 'ALL', scope: null,
        description: 'A failure in the regional power interconnection caused a significant drop in Internet traffic across multiple providers in Honduras.',
        startDate: '2026-09-15T09:45:00Z', endDate: '2026-09-15T11:15:00Z',
        locations: ['HN'], asns: [], asnsDetails: [], locationsDetails: [{ name: 'Honduras', code: 'HN' }],
        eventType: 'OUTAGE', linkedUrl: 'https://x.com/CloudflareRadar/status/1', outage: { outageCause: 'POWER_OUTAGE', outageType: 'NATIONWIDE' },
      },
      { id: 'old', startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-02T00:00:00Z', locations: ['DE'], locationsDetails: [], outage: {} },
      { id: 'future', startDate: '2026-09-16T00:00:00Z', endDate: null, locations: ['FR'], locationsDetails: [], outage: {} },
      { id: 'network', startDate: '2026-09-15T11:00:00Z', endDate: null, locations: ['US'], asns: [13335], asnsDetails: [{ asn: '13335', name: 'Cloudflare', locations: { code: 'US', name: 'United States' } }], locationsDetails: [{ name: 'United States', code: 'US' }], outage: { outageCause: 'TECHNICAL_PROBLEM', outageType: 'NETWORK' } },
    ],
  };

  it('maps nationwide outages with cause, scope and resolution', () => {
    const out = radar._internal.mapOutages(fixture, NOW);
    const hn = out.find((i) => i.id === 'cf-out-1667')!;
    expect(hn.type).toBe('outage');
    expect(hn.severity).toBe('critical');
    expect(hn.status).toBe('resolved');
    expect(hn.cause).toBe('POWER_OUTAGE');
    expect(hn.location.countryCode).toBe('HN');
    expect(hn.resolvedAt).toBe('2026-09-15T11:15:00.000Z');
    expect(hn.timeline.map((e) => e.type)).toEqual(['detected', 'resolved']);
    expect(hn.link).toContain('x.com');
  });

  it('drops annotations outside the 24h window and in the future', () => {
    const ids = radar._internal.mapOutages(fixture, NOW).map((i) => i.id);
    expect(ids).not.toContain('cf-out-old');
    expect(ids).not.toContain('cf-out-future');
  });

  it('places network-scoped outages at the known ASN home', () => {
    const net = radar._internal.mapOutages(fixture, NOW).find((i) => i.id === 'cf-out-network')!;
    expect(net.severity).toBe('medium');
    expect(net.status).toBe('active');
    expect(net.affectedASNs[0]).toMatchObject({ asn: 13335, name: 'Cloudflare' });
    expect(net.location.city).toBe('San Jose'); // AS13335 home in server/data/asns.js
  });
});

describe('Radar BGP hijack events', () => {
  const fixture = {
    asn_info: [
      { asn: 14244, org_name: 'NSI Hosting', country_code: 'US' },
      { asn: 8220, org_name: 'COLT Technology Services Group Limited', country_code: 'GB' },
    ],
    events: [
      { id: 1, hijacker_asn: 14244, hijacker_country: 'US', victim_asns: [8220], victim_countries: ['GB'], prefixes: ['185.157.227.0/24'], min_hijack_ts: '2026-09-15T10:56:59.723', max_hijack_ts: '2026-09-15T10:57:59.723', max_msg_ts: '2026-09-15T10:59:13.256', confidence_score: 4, peer_ip_count: 1, hijack_msgs_count: 1, on_going_count: 0 },
      { id: 2, hijacker_asn: 14244, hijacker_country: 'US', victim_asns: [8220], victim_countries: ['GB'], prefixes: ['185.157.228.0/24', '185.157.227.0/24'], min_hijack_ts: '2026-09-15T11:30:00', max_hijack_ts: '2026-09-15T11:58:00', max_msg_ts: '2026-09-15T11:59:00', confidence_score: 10, peer_ip_count: 12, hijack_msgs_count: 40, on_going_count: 3 },
    ],
  };

  it('collapses repeated detections of the same pair, parses UTC and keeps the strongest score', () => {
    const out = radar._internal.mapHijacks(fixture, NOW);
    expect(out).toHaveLength(1);
    const h = out[0];
    expect(h.id).toBe('cf-hj-14244-8220');
    expect(h.type).toBe('bgp');
    expect(h.severity).toBe('critical'); // conf 10 with 12 peers
    expect(h.status).toBe('active'); // one detection still ongoing
    expect(h.startedAt).toBe('2026-09-15T10:56:59.723Z');
    expect(h.metrics).toMatchObject({ prefixes: 2, confidence: 10, events: 2, peers: 12 });
    expect(h.title).toContain('AS14244 NSI Hosting');
    expect(h.title).toContain('AS8220 COLT');
    expect(h.affectedASNs.map((a) => a.role)).toEqual(['victim', 'hijacker']);
    expect(h.location.countryCode).toBe('GB');
    expect(h.path?.[0].from.countryCode).toBe('US');
    expect(h.link).toBe('https://radar.cloudflare.com/routing/as8220');
  });

  it('marks a finished pair as resolved after ten quiet minutes', () => {
    const only = { ...fixture, events: [fixture.events[0]] };
    const [h] = radar._internal.mapHijacks(only, NOW);
    expect(h.status).toBe('resolved');
    expect(h.resolvedAt).toBe('2026-09-15T10:59:13.256Z');
    expect(h.severity).toBe('low');
  });
});

describe('Radar BGP leak events', () => {
  const fixture = {
    asn_info: [
      { asn: 204720, org_name: 'GLOBAL CLOUD NETWORK LLC', country_code: 'RU' },
      { asn: 3216, org_name: 'PJSC Vimpelcom', country_code: 'NL' },
      { asn: 35598, org_name: 'Inetcom', country_code: 'RU' },
    ],
    events: [
      { id: 612509, leak_asn: 204720, leak_count: 20, leak_seg: [3216, 204720, 35598], leak_type: 1, min_ts: '2026-09-15T11:02:50', max_ts: '2026-09-15T11:02:57', detected_ts: '2026-09-15T11:02:50', finished: false, origin_count: 1, peer_count: 4, prefix_count: 5, countries: ['RU'] },
      { id: 612510, leak_asn: 204720, leak_count: 3, leak_seg: [3216, 204720, 35598], leak_type: 1, min_ts: '2026-09-15T10:00:00', max_ts: '2026-09-15T10:01:00', detected_ts: '2026-09-15T10:00:00', finished: true, origin_count: 1, peer_count: 2, prefix_count: 14, countries: ['RU'] },
    ],
  };

  it('collapses to one incident per leaking ASN with summed prefixes', () => {
    const out = radar._internal.mapLeaks(fixture, NOW);
    expect(out).toHaveLength(1);
    const l = out[0];
    expect(l.id).toBe('cf-leak-204720');
    expect(l.title).toBe('Route leak by AS204720 GLOBAL CLOUD NETWORK LLC, 19 prefixes');
    expect(l.metrics).toMatchObject({ prefixes: 19, events: 2, peers: 4 });
    expect(l.status).toBe('active'); // latest event not finished
    expect(l.startedAt).toBe('2026-09-15T10:00:00.000Z');
    expect(l.affectedASNs[0]).toMatchObject({ asn: 204720, role: 'leaker' });
    expect(l.location.countryCode).toBe('RU');
    expect(l.path?.[0].label).toBe('AS204720 → AS3216');
  });
});

describe('Radar L3 attack pairs', () => {
  const fixture = { top_0: [
    { originCountryAlpha2: 'BR', originCountryName: 'Brazil', targetCountryName: 'Hong Kong', targetCountryAlpha2: 'HK', value: '4.894104' },
    { originCountryAlpha2: 'US', originCountryName: 'United States', targetCountryName: 'United States', targetCountryAlpha2: 'US', value: '3.238085' },
    { originCountryAlpha2: 'ZZ', originCountryName: 'Nowhere', targetCountryName: 'Hong Kong', targetCountryAlpha2: 'HK', value: '1' },
  ] };

  it('maps pairs to aggregated ddos incidents anchored to the hour', () => {
    const out = radar._internal.mapAttacks(fixture, NOW);
    expect(out).toHaveLength(2); // unknown country dropped
    const br = out[0];
    expect(br.id).toBe('cf-ddos-br-hk');
    expect(br.type).toBe('ddos');
    expect(br.aggregated).toBe(true);
    expect(br.severity).toBe('high');
    expect(br.metrics.sharePct).toBeCloseTo(4.894, 3);
    expect(br.path?.[0].from.countryCode).toBe('BR');
    expect(br.location.countryCode).toBe('HK');
    expect(br.startedAt).toBe(new Date(Math.floor(NOW / 3_600_000) * 3_600_000 - 86_400_000).toISOString());
  });
});
