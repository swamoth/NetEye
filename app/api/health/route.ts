import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/incidents';
import type { HealthReport } from '@/app/utils/types';

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

/** GET /api/health — liveness plus per-source status (latency, coverage, errors). 207 when a source is unhealthy or none is configured. */
export async function GET() {
  const snap = await getSnapshot();
  const enabled = snap.sources.filter((s) => s.mode !== 'disabled');
  const degraded = enabled.length === 0 || enabled.some((s) => s.status !== 'ok');
  const report: HealthReport = {
    status: degraded ? 'degraded' : 'ok',
    service: 'neteye-api',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
    now: snap.now,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    sources: snap.sources,
    incidents: {
      total: snap.incidents.length,
      active: snap.incidents.filter((i) => i.status !== 'resolved').length,
    },
    websocket: { url: process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:${process.env.WS_PORT || 3001}` },
  };
  return NextResponse.json(report, { status: degraded ? 207 : 200, headers: { 'cache-control': 'no-store' } });
}
