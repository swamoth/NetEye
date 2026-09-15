/**
 * Persistence boundary.
 *
 * API routes talk to an `IncidentStore`, never to the aggregator directly, so the data layer can be
 * swapped without touching HTTP code. Today there is one implementation:
 *
 *   MemoryStore — answers every query from the aggregator's in-memory snapshot (upstream responses
 *                 are already cached inside the source adapters).
 *
 * Adding a durable store (Postgres/TimescaleDB, schema in db/schema.sql):
 *   1. implement `IncidentStore` (e.g. lib/stores/postgres.ts) — `getSnapshot` reads the hypertable
 *      for the last 24h, a background job calls the aggregator and `upsertIncidents()` every tick;
 *   2. return it from `getStore()` when `DATABASE_URL` is set.
 * Nothing above this file needs to change.
 */

import type { Incident, Snapshot, SourceStatus, Stats } from '@/app/utils/types';
import * as aggregator from '@/server/aggregator';

export interface IncidentStore {
  readonly kind: 'memory' | 'postgres';
  getSnapshot(now?: number): Promise<Snapshot>;
  getIncident(id: string, now?: number): Promise<Incident | null>;
  getStats(now?: number): Promise<Stats>;
  getSources(now?: number): Promise<SourceStatus[]>;
}

class MemoryStore implements IncidentStore {
  readonly kind = 'memory' as const;
  private inflight: Promise<Snapshot> | null = null;
  private last: { at: number; snap: Snapshot } | null = null;

  /**
   * Coalesce concurrent callers (SSR page + API polls) onto one snapshot computation and reuse it
   * for a couple of seconds — the aggregator is cheap, but the live adapters are not free.
   */
  getSnapshot(now = Date.now()): Promise<Snapshot> {
    if (this.last && now - this.last.at < 2000) return Promise.resolve(this.last.snap);
    if (!this.inflight) {
      this.inflight = aggregator
        .getSnapshot(now)
        .then((snap) => { this.last = { at: now, snap }; return snap; })
        .finally(() => { this.inflight = null; });
    }
    return this.inflight;
  }

  async getIncident(id: string, now = Date.now()): Promise<Incident | null> {
    const snap = await this.getSnapshot(now);
    return snap.incidents.find((i) => i.id === id) ?? (await aggregator.getIncident(id, now));
  }

  getStats(now = Date.now()): Promise<Stats> {
    return aggregator.getStats(now);
  }

  async getSources(now = Date.now()): Promise<SourceStatus[]> {
    return (await this.getSnapshot(now)).sources;
  }
}

declare global {
  // Survive Next.js dev-mode module reloads.
  var __neteyeStore: IncidentStore | undefined;
}

export function getStore(): IncidentStore {
  if (!globalThis.__neteyeStore) {
    if (process.env.DATABASE_URL) {
      console.warn('[neteye] DATABASE_URL is set but no Postgres store is wired yet — using MemoryStore. See lib/db.ts.');
    }
    globalThis.__neteyeStore = new MemoryStore();
  }
  return globalThis.__neteyeStore;
}
