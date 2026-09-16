import { describe, expect, it } from 'vitest';
import type { Incident } from '../app/utils/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAggregator, statusAt, WINDOW_MS } = require('../server/aggregator') as typeof import('../server/aggregator');

const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

function inc(id: string, over: Partial<Incident> = {}): Incident {
  return {
    id,
    type: 'bgp',
    severity: 'low',
    status: 'active',
    title: `Incident ${id}`,
    description: 'desc',
    location: { lat: 1, lng: 2, country: 'Testland', countryCode: 'TL', region: 'Europe' },
    affectedASNs: [{ asn: 64500, name: 'Example', role: 'victim' }],
    metrics: {},
    source: 'fake',
    sourceName: 'Fake feed',
    confidence: 0.5,
    startedAt: iso(NOW - 60_000),
    updatedAt: iso(NOW - 60_000),
    timeline: [],
    ...over,
  };
}

function adapter(id: string, incidents: Incident[], extra: Partial<{ status: string; coveredTypes: string[]; throws: boolean }> = {}) {
  return {
    id,
    name: `Adapter ${id}`,
    types: ['bgp', 'outage'] as Incident['type'][],
    async fetchIncidents() {
      if (extra.throws) throw new Error('boom');
      return { incidents, status: (extra.status ?? 'ok') as 'ok', coveredTypes: (extra.coveredTypes ?? ['bgp']) as Incident['type'][], latencyMs: 12, lastPoll: iso(NOW), error: null };
    },
  };
}

describe('live aggregator', () => {
  it('merges adapters, newest first, and reports per-source status', async () => {
    const agg = createAggregator({
      sources: [
        adapter('a', [inc('a1', { startedAt: iso(NOW - 3_600_000) }), inc('a2', { startedAt: iso(NOW - 60_000) })]),
        adapter('b', [inc('b1', { startedAt: iso(NOW - 600_000) })]),
      ],
    });
    const snap = await agg.getSnapshot(NOW);
    expect(snap.incidents.map((i) => i.id)).toEqual(['a2', 'b1', 'a1']);
    expect(snap.sources).toHaveLength(2);
    expect(snap.sources[0]).toMatchObject({ id: 'a', mode: 'live', status: 'ok', count: 2, coveredTypes: ['bgp'] });
    expect(snap.windowMs).toBe(WINDOW_MS);
  });

  it('drops future, stale and duplicate incidents defensively', async () => {
    const agg = createAggregator({
      sources: [adapter('a', [
        inc('future', { startedAt: iso(NOW + 5_000) }),
        inc('stale', { startedAt: iso(NOW - 3 * WINDOW_MS), resolvedAt: iso(NOW - 2 * WINDOW_MS), status: 'resolved' }),
        inc('old-but-open', { startedAt: iso(NOW - 3 * WINDOW_MS) }),
        inc('dup'),
        inc('dup'),
      ])],
    });
    const snap = await agg.getSnapshot(NOW);
    expect(snap.incidents.map((i) => i.id).sort()).toEqual(['dup', 'old-but-open']);
  });

  it('never throws when an adapter fails, and marks it as an error', async () => {
    const agg = createAggregator({ sources: [adapter('bad', [], { throws: true }), adapter('good', [inc('g1')])] });
    const snap = await agg.getSnapshot(NOW);
    expect(snap.incidents.map((i) => i.id)).toEqual(['g1']);
    expect(snap.sources[0]).toMatchObject({ id: 'bad', status: 'error', count: 0 });
    expect(snap.sources[0].error).toContain('boom');
  });

  it('reports a disabled adapter without inventing data', async () => {
    const agg = createAggregator({ sources: [adapter('off', [], { status: 'disabled', coveredTypes: [] })] });
    const snap = await agg.getSnapshot(NOW);
    expect(snap.incidents).toEqual([]);
    expect(snap.sources[0]).toMatchObject({ mode: 'disabled', status: 'disabled' });
  });

  it('computes stats that agree with the snapshot', async () => {
    const agg = createAggregator({
      sources: [adapter('a', [
        inc('x', { type: 'bgp', severity: 'high', location: { lat: 0, lng: 0, country: 'A', countryCode: 'AA', region: 'Europe' } }),
        inc('y', { type: 'ddos', aggregated: true, metrics: { sharePct: 4.5 }, location: { lat: 0, lng: 0, country: 'B', countryCode: 'BB', region: 'Asia' } }),
        inc('z', { status: 'resolved', resolvedAt: iso(NOW - 1000), location: { lat: 0, lng: 0, country: 'C', countryCode: 'CC', region: 'Europe' } }),
      ])],
    });
    const [snap, stats] = await Promise.all([agg.getSnapshot(NOW), agg.getStats(NOW)]);
    expect(stats.total).toBe(snap.incidents.length);
    expect(stats.active).toBe(2);
    expect(stats.byType).toEqual({ bgp: 2, ddos: 1 });
    expect(stats.countriesAffected).toBe(1); // aggregated and resolved excluded
    expect(stats.ddosShareCoveredPct).toBe(4.5);
    expect(stats.topASNs[0]).toMatchObject({ asn: 64500, incidents: 2 });
    expect(stats.sources[0]).toMatchObject({ id: 'a', status: 'ok' });
  });

  it('getIncident finds by id or returns null', async () => {
    const agg = createAggregator({ sources: [adapter('a', [inc('k')])] });
    expect((await agg.getIncident('k', NOW))?.id).toBe('k');
    expect(await agg.getIncident('nope', NOW)).toBeNull();
  });

  it('statusAt derives the lifecycle from timestamps', () => {
    const i = inc('s', { startedAt: iso(NOW), mitigatingAt: iso(NOW + 60_000), resolvedAt: iso(NOW + 120_000) });
    expect(statusAt(i, NOW - 1)).toBeNull();
    expect(statusAt(i, NOW)).toBe('active');
    expect(statusAt(i, NOW + 60_000)).toBe('mitigating');
    expect(statusAt(i, NOW + 120_000)).toBe('resolved');
  });
});
