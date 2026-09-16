import { NextRequest, NextResponse } from 'next/server';
import type { AsnAnomaly, AsnNeighbour, AsnProfile, NeighbourType } from '@/app/utils/types';
import { announcedPrefixes, asOverview, asnNeighbours, routingStatus } from '@/lib/ripestat';
import { asnEntities, asnEntity, hijacksInvolving, leaksInvolving, parseRadarTs, radarEnabled, routeStats } from '@/lib/radar';
import { placeForAsn, placeForCountry } from '@/server/geo';
import { ASN_BY_NUMBER } from '@/server/data/asns';

export const dynamic = 'force-dynamic';

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, { at: number; profile: AsnProfile }>();

const NEIGHBOUR_TYPE: Record<'left' | 'right' | 'uncertain', NeighbourType> = { left: 'upstream', right: 'downstream', uncertain: 'uncertain' };

/**
 * GET /api/asn/:asn — everything the ASN explorer shows, from keyless RIPEstat plus Cloudflare
 * Radar (when a token is configured). Partial results are returned with `sources` marking what
 * failed; nothing is estimated or filled in.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ asn: string }> }) {
  const { asn: raw } = await ctx.params;
  const asn = Number(String(raw).replace(/^as/i, ''));
  if (!Number.isInteger(asn) || asn <= 0 || asn > 4294967295) {
    return NextResponse.json({ error: 'Invalid ASN' }, { status: 400 });
  }
  const hit = cache.get(asn);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.profile, { headers: { 'cache-control': 'public, max-age=120' } });
  }

  const [overview, status, neigh, prefixes, entity, stats, hijacks, leaks] = await Promise.all([
    asOverview(asn),
    routingStatus(asn),
    asnNeighbours(asn),
    announcedPrefixes(asn),
    asnEntity(asn),
    routeStats(asn),
    hijacksInvolving(asn),
    leaksInvolving(asn),
  ]);

  const ripeOk = Boolean(overview || status || neigh);
  const radarOk = radarEnabled() && Boolean(entity || stats);
  const known = ASN_BY_NUMBER.get(asn);
  const cc = entity?.country?.toUpperCase() ?? known?.cc ?? null;
  const location = placeForAsn(asn) ?? (cc ? placeForCountry(cc) : null);

  // Top neighbours by power, enriched with Radar names/countries in one batch call.
  const ranked = (neigh?.neighbours ?? []).slice().sort((a, b) => b.power - a.power).slice(0, 14);
  const enrich = radarEnabled() ? await asnEntities(ranked.map((n) => n.asn)) : new Map();
  const top: AsnNeighbour[] = ranked.map((n) => {
    const e = enrich.get(n.asn);
    const k = ASN_BY_NUMBER.get(n.asn);
    const ncc = e?.country?.toUpperCase() ?? k?.cc ?? null;
    const place = placeForAsn(n.asn) ?? (ncc ? placeForCountry(ncc) : null);
    return {
      asn: n.asn,
      name: e?.name ?? k?.name ?? null,
      countryCode: ncc,
      type: NEIGHBOUR_TYPE[n.type],
      power: n.power,
      location: place ? { lat: place.lat, lng: place.lng, name: place.city ?? place.country, countryCode: place.countryCode } : null,
    };
  });

  const anomalies: AsnAnomaly[] = [
    ...hijacks.map((h): AsnAnomaly => {
      const victim = h.victim_asns?.[0];
      const role = h.hijacker_asn === asn ? 'hijacker' : victim === asn ? 'victim' : 'involved';
      return {
        id: `hijack-${h.id}`,
        kind: 'hijack',
        role,
        title: `AS${h.hijacker_asn} announced ${h.prefixes?.length ?? 0} prefix${h.prefixes?.length === 1 ? '' : 'es'} of AS${victim}`,
        startedAt: new Date(parseRadarTs(h.min_hijack_ts)).toISOString(),
        endedAt: h.max_hijack_ts ? new Date(parseRadarTs(h.max_hijack_ts)).toISOString() : null,
        prefixes: h.prefixes?.length ?? 0,
        score: h.confidence_score ?? null,
        link: `https://radar.cloudflare.com/routing/as${victim ?? asn}`,
      };
    }),
    ...leaks.map((l): AsnAnomaly => ({
      id: `leak-${l.id}`,
      kind: 'leak',
      role: l.leak_asn === asn ? 'leaker' : 'involved',
      title: `AS${l.leak_asn} leaked ${l.prefix_count} prefix${l.prefix_count === 1 ? '' : 'es'} from ${l.origin_count} origin${l.origin_count === 1 ? '' : 's'}`,
      startedAt: new Date(parseRadarTs(l.min_ts)).toISOString(),
      endedAt: l.max_ts ? new Date(parseRadarTs(l.max_ts)).toISOString() : null,
      prefixes: l.prefix_count,
      score: null,
      link: `https://radar.cloudflare.com/routing/as${l.leak_asn}`,
    })),
  ]
    .filter((a) => !Number.isNaN(Date.parse(a.startedAt)))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 20);

  const counts = neigh?.counts ?? { left: 0, right: 0, uncertain: 0, unique: 0 };
  const v4 = prefixes.filter((p) => !p.includes(':'));
  const v6 = prefixes.filter((p) => p.includes(':'));

  const profile: AsnProfile = {
    asn,
    name: entity?.name ?? overview?.holder?.replace(/^[A-Z0-9-]+\s+-\s+/, '') ?? known?.name ?? null,
    org: entity?.orgName ?? null,
    countryCode: cc,
    country: entity?.countryName ?? (location?.country ?? null),
    website: entity?.website ?? null,
    location,
    announced: overview?.announced ?? prefixes.length > 0,
    prefixes: {
      // routing-status counts first; the announced-prefixes list second; null (not 0) when neither answered.
      v4: status?.announcedV4Prefixes ?? (prefixes.length ? v4.length : null),
      v6: status?.announcedV6Prefixes ?? (prefixes.length ? v6.length : null),
      sample: [...v4.slice(0, 8), ...v6.slice(0, 4)],
    },
    visibility: status?.visibility ?? null,
    rpki: stats
      ? { total: stats.routes_total ?? 0, valid: stats.routes_valid ?? 0, invalid: stats.routes_invalid ?? 0, unknown: stats.routes_unknown ?? 0 }
      : null,
    estimatedUsers: entity?.estimatedUsers?.estimatedUsers ?? null,
    neighbours: {
      counts: { upstream: counts.left, downstream: counts.right, uncertain: counts.uncertain, unique: counts.unique },
      top,
    },
    anomalies,
    sources: { ripestat: ripeOk ? 'ok' : 'error', radar: !radarEnabled() ? 'disabled' : radarOk ? 'ok' : 'error' },
    fetchedAt: new Date().toISOString(),
  };

  if (!ripeOk && !radarOk) {
    return NextResponse.json({ error: `No data for AS${asn}: RIPEstat did not answer${radarEnabled() ? ' and Cloudflare Radar returned nothing' : ''}.` }, { status: 502 });
  }
  cache.set(asn, { at: Date.now(), profile });
  return NextResponse.json(profile, { headers: { 'cache-control': 'public, max-age=120' } });
}
