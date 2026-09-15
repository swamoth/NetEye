import { NextRequest, NextResponse } from 'next/server';
import { getIncident } from '@/lib/incidents';

export const dynamic = 'force-dynamic';

/** GET /api/outages/:id — one incident with its full event timeline. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const incident = await getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: `Incident ${id} not found (it may have aged out of the 24h window)` }, { status: 404 });
  }
  return NextResponse.json(incident, { headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
