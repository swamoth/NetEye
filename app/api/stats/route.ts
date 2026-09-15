import { NextResponse } from 'next/server';
import { getStats } from '@/lib/incidents';

export const dynamic = 'force-dynamic';

/** GET /api/stats — roll-up of the current 24h window (counts by type/severity/region, top ASNs). */
export async function GET() {
  const stats = await getStats();
  return NextResponse.json(stats, { headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
