import { NextRequest, NextResponse } from 'next/server';
import { asOverview, geolocateIp, networkInfo, whatsMyIp } from '@/lib/ripestat';
import type { WhoAmI } from '@/app/utils/types';
import { ASN_BY_NUMBER } from '@/server/data/asns';
import { COUNTRIES } from '@/server/data/countries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whoami — "Am I affected?" lookup.
 *
 * Resolves the caller's public IP to ASN / holder / prefix / rough location using the keyless
 * RIPEstat API. The IP is only ever returned masked and is not logged. Behind a proxy (Vercel,
 * nginx) the client IP arrives in x-forwarded-for; on localhost we ask RIPE for our egress IP,
 * which in local development is the developer's own connection.
 */

const PRIVATE_RE = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80|0\.0\.0\.0|localhost)/i;

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || null;
  if (!first || PRIVATE_RE.test(first)) return null;
  return first.replace(/^::ffff:/, '');
}

function mask(ip: string): string {
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 3).join(':')}:…`;
  }
  const p = ip.split('.');
  return `${p[0]}.${p[1]}.•.•`;
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req) ?? (await whatsMyIp());
  if (!ip) {
    return NextResponse.json({ error: 'Could not determine your public IP address' }, { status: 502 });
  }

  const [net, geo] = await Promise.all([networkInfo(ip), geolocateIp(ip)]);
  const asn = net?.asns?.[0] ?? null;
  const overview = asn ? await asOverview(asn) : null;

  // RIPEstat holder strings look like "RELIANCEJIO-IN - Reliance Jio Infocomm Limited"; keep the readable part.
  const holder = overview?.holder?.replace(/^[A-Z0-9-]+\s+-\s+/, '') ?? (asn ? ASN_BY_NUMBER.get(asn)?.name : null) ?? null;
  const cc = geo?.country?.toUpperCase() ?? null;
  const out: WhoAmI = {
    ipMasked: mask(ip),
    asn,
    holder,
    prefix: net?.prefix ?? null,
    country: cc ? COUNTRIES[cc]?.name ?? cc : null,
    countryCode: cc,
    city: geo?.city ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  };
  if (!out.asn && !out.lat) {
    return NextResponse.json({ error: 'RIPEstat did not return network information for your address' }, { status: 502 });
  }
  return NextResponse.json(out, { headers: { 'cache-control': 'private, no-store' } });
}
