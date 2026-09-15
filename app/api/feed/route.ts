import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/incidents';
import { TYPE_META, SEVERITY_META } from '@/app/utils/theme';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);

/** GET /api/feed — RSS 2.0 feed of the last 24h of incidents (newest first, aggregates excluded). */
export async function GET(req: NextRequest) {
  const snap = await getSnapshot();
  const origin = req.nextUrl.origin;
  const items = snap.incidents
    .filter((i) => !i.aggregated)
    .slice(0, 100)
    .map((i) => {
      const link = `${origin}/?incident=${encodeURIComponent(i.id)}`;
      const where = [i.location.city, i.location.country].filter(Boolean).join(', ');
      return `    <item>
      <title>${esc(`[${TYPE_META[i.type].short}/${SEVERITY_META[i.severity].label}] ${i.title}`)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(i.id)}</guid>
      <pubDate>${new Date(i.startedAt).toUTCString()}</pubDate>
      <category>${esc(TYPE_META[i.type].label)}</category>
      <category>${esc(SEVERITY_META[i.severity].label)}</category>
      <description>${esc(`${where}, ${i.status}. ${i.description} Source: ${i.sourceName}.`)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NetEye: internet incidents, last 24 hours</title>
    <link>${esc(origin)}</link>
    <atom:link href="${esc(`${origin}/api/feed`)}" rel="self" type="application/rss+xml" />
    <description>Outages, BGP anomalies, DDoS activity and submarine cable faults tracked by NetEye.</description>
    <language>en</language>
    <lastBuildDate>${new Date(snap.now).toUTCString()}</lastBuildDate>
    <ttl>5</ttl>
${items}
  </channel>
</rss>
`;
  return new NextResponse(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
