import { NextRequest, NextResponse } from 'next/server';
import { queryOutages } from '@/lib/incidents';
import { toCsv, exportFilename } from '@/app/utils/export';

export const dynamic = 'force-dynamic';

/**
 * GET /api/outages
 *
 * Query params (all optional, comma-separated where it makes sense):
 *   type=outage,bgp,ddos,cable_cut   severity=low,medium,high,critical   status=active,mitigating,resolved
 *   since=-6h | ISO | epoch-ms        q=free text                          asn=13335   country=IN
 *   limit=1..1000                     format=json|csv
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const now = Date.now();
  const result = await queryOutages(
    {
      type: sp.get('type'),
      severity: sp.get('severity'),
      status: sp.get('status'),
      since: sp.get('since'),
      q: sp.get('q'),
      asn: sp.get('asn'),
      country: sp.get('country'),
      limit: sp.get('limit'),
    },
    now,
  );

  if (sp.get('format') === 'csv') {
    return new NextResponse(toCsv(result.incidents), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${exportFilename('csv', now)}"`,
        'cache-control': 'no-store',
      },
    });
  }

  return NextResponse.json(result, {
    headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  });
}
