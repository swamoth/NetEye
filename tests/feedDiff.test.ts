import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { diffIncidents } = require('../server/feedDiff.js');

const inc = (id: string, updatedAt: string, status = 'active', severity = 'high') => ({ id, updatedAt, status, severity });

describe('feedDiff', () => {
  it('reports added, updated and removed incidents', () => {
    const last = new Map([['a', inc('a', 't1')], ['b', inc('b', 't1')], ['c', inc('c', 't1')]]);
    const now = [inc('a', 't1'), inc('b', 't2'), inc('d', 't1')];
    const d = diffIncidents(last, now);
    expect(d.added.map((i: { id: string }) => i.id)).toEqual(['d']);
    expect(d.updated.map((i: { id: string }) => i.id)).toEqual(['b']);
    expect(d.removed).toEqual(['c']);
    expect(d.empty).toBe(false);
    expect([...d.current.keys()]).toEqual(['a', 'b', 'd']);
  });

  it('is empty when nothing the UI shows has changed', () => {
    const last = new Map([['a', inc('a', 't1')]]);
    expect(diffIncidents(last, [inc('a', 't1')]).empty).toBe(true);
    expect(diffIncidents(last, [inc('a', 't1', 'resolved')]).updated).toHaveLength(1);
    expect(diffIncidents(last, [inc('a', 't1', 'active', 'critical')]).updated).toHaveLength(1);
  });

  it('treats an empty last snapshot as everything added', () => {
    const d = diffIncidents(new Map(), [inc('a', 't1'), inc('b', 't1')]);
    expect(d.added).toHaveLength(2);
    expect(d.removed).toEqual([]);
  });
});
