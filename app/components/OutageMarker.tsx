'use client';

/**
 * Turns incidents into globe.gl layer data.
 *
 * globe.gl matches data to Three.js objects by *object identity*, so every builder here keeps a
 * per-id cache and mutates existing datums instead of recreating them. That is what keeps
 * ring/arc animations from restarting on every tick and keeps the frame rate flat.
 *
 * Marks on the globe use the brighter `glow` step of each type hue (the globe surface is far darker
 * than the panels); everything drawn on panels uses the validated `color` step.
 */

import { useMemo, useRef } from 'react';
import type { Geometry } from 'geojson';
import type { Incident, IncidentType, WhoAmI } from '@/app/utils/types';
import { SEVERITY_META, STATUS_META, TYPE_META, withAlpha } from '@/app/utils/theme';
import { fadeAt, statusAt } from '@/app/utils/incidents';
import { formatRelative } from '@/app/utils/format';
import { arcAltitudeFor } from '@/app/utils/coordinates';
import type { CountryFeature } from '@/app/hooks/useGeoData';

export type MarkerKind = 'incident' | 'you' | 'asn' | 'neighbour';

export interface PointDatum {
  id: string;
  /** Incident id for incident markers; ASN as string for network markers. */
  incidentId: string;
  kind: MarkerKind;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  altitude: number;
  type: IncidentType | null;
  label: string;
}

export interface RingDatum {
  id: string;
  lat: number;
  lng: number;
  color: string;
  maxR: number;
  speed: number;
  period: number;
}

export interface ArcDatum {
  id: string;
  incidentId: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string | string[];
  stroke: number;
  dashLength: number;
  dashGap: number;
  dashAnimateTime: number;
  /** Always set via arcAltitudeFor(); globe.gl's auto-scale would clip long arcs. */
  altitude: number;
  label: string;
}

export interface PathDatum {
  id: string;
  incidentId: string;
  points: [number, number][];
  color: string | string[];
  stroke: number;
  dashLength: number;
  dashGap: number;
  dashAnimateTime: number;
  label: string;
}

export interface PolygonDatum {
  id: string;
  geometry: Geometry;
  /** Cap fill (kept faint: the dot-matrix surface carries the colour). */
  color: string;
  stroke: string;
  /** Solid type colour for the globe surface's tint map. */
  tint: string;
  label: string;
  /** Most severe active incident in the country: what a click on the country opens. */
  incidentId: string;
  /** Active incidents in the country. */
  count: number;
}

export interface GlobeLayers {
  points: PointDatum[];
  rings: RingDatum[];
  arcs: ArcDatum[];
  paths: PathDatum[];
  polygons: PolygonDatum[];
}

export interface LayerOptions {
  t: number;
  selectedId: string | null;
  hoveredId: string | null;
  you: WhoAmI | null;
  affectedByYou: Set<string>;
  findCountry?: (lat: number, lng: number) => CountryFeature | undefined;
  /** Honour prefers-reduced-motion: no pulse rings, no dash animation. */
  reducedMotion?: boolean;
}

export const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

/** HTML tooltip shown by globe.gl on hover. */
export function tooltipHtml(inc: Incident, t: number): string {
  const s = statusAt(inc, t) ?? inc.status;
  const where = [inc.location.city, inc.location.country].filter(Boolean).join(', ');
  return `<div class="tt-title"><span class="tt-dot" style="background:${TYPE_META[inc.type].glow}"></span>${esc(inc.title)}</div>
<div class="tt-meta">${TYPE_META[inc.type].label}, ${SEVERITY_META[inc.severity].label.toLowerCase()} severity, ${STATUS_META[s].label.toLowerCase()}</div>
<div class="tt-meta">${esc(where)} · started ${formatRelative(inc.startedAt, t)}</div>
<div class="tt-meta">Source: ${esc(inc.sourceName)}</div>`;
}

export function upsert<T extends { id: string }>(cache: Map<string, T>, id: string, make: () => T, update: (d: T) => void): T {
  let d = cache.get(id);
  if (!d) {
    d = make();
    cache.set(id, d);
  } else {
    update(d);
  }
  return d;
}

export function prune<T>(cache: Map<string, T>, keep: Set<string>) {
  for (const k of cache.keys()) if (!keep.has(k)) cache.delete(k);
}

/**
 * Build all globe layers for the incidents visible at `t`. Object identity is preserved across
 * calls for unchanged ids.
 */
export function useGlobeLayers(visible: Incident[], opts: LayerOptions): GlobeLayers {
  const points = useRef(new Map<string, PointDatum>());
  const rings = useRef(new Map<string, RingDatum>());
  const arcs = useRef(new Map<string, ArcDatum>());
  const paths = useRef(new Map<string, PathDatum>());
  const polygons = useRef(new Map<string, PolygonDatum>());

  return useMemo(() => {
    const { t, selectedId, hoveredId, you, affectedByYou, findCountry, reducedMotion } = opts;
    const outPoints: PointDatum[] = [];
    const outRings: RingDatum[] = [];
    const outArcs: ArcDatum[] = [];
    const outPaths: PathDatum[] = [];
    const outPolys: PolygonDatum[] = [];
    const keepP = new Set<string>(), keepR = new Set<string>(), keepA = new Set<string>(), keepPa = new Set<string>(), keepPo = new Set<string>();
    const countryHits = new Map<string, { feature: CountryFeature; type: IncidentType; severityRank: number; incidentId: string; count: number }>();

    for (const inc of visible) {
      const status = statusAt(inc, t) ?? inc.status;
      const fade = fadeAt(inc, t);
      const meta = TYPE_META[inc.type];
      const sev = SEVERITY_META[inc.severity];
      const isSelected = inc.id === selectedId;
      const isHovered = inc.id === hoveredId;
      const mine = affectedByYou.has(inc.id);
      const emphasis = isSelected ? 1.35 : isHovered ? 1.2 : mine ? 1.15 : 1;
      const alpha = status === 'resolved' ? 0.35 * fade + 0.15 : 0.95;
      const color = withAlpha(meta.glow, alpha);

      keepP.add(inc.id);
      const p = upsert(points.current, inc.id,
        () => ({ id: inc.id, incidentId: inc.id, kind: 'incident' as MarkerKind, lat: inc.location.lat, lng: inc.location.lng, color, radius: sev.radius * emphasis, altitude: sev.altitude * emphasis, type: inc.type, label: '' }),
        (d) => { d.lat = inc.location.lat; d.lng = inc.location.lng; d.color = color; d.radius = sev.radius * emphasis; d.altitude = sev.altitude * emphasis; });
      p.label = tooltipHtml(inc, t);
      outPoints.push(p);

      if (status !== 'resolved' && !reducedMotion) {
        const intensity = status === 'active' ? 1 : 0.6;
        keepR.add(inc.id);
        outRings.push(upsert(rings.current, inc.id,
          () => ({ id: inc.id, lat: inc.location.lat, lng: inc.location.lng, color: meta.glow, maxR: 1.5 + sev.rank * 1.2, speed: 1.2 + sev.rank * 0.5, period: status === 'active' ? 1400 - sev.rank * 200 : 2200 }),
          (d) => { d.maxR = (1.5 + sev.rank * 1.2) * intensity; d.period = status === 'active' ? 1400 - sev.rank * 200 : 2200; }));
      }

      if (inc.path && status !== 'resolved') {
        inc.path.forEach((seg, i) => {
          const aid = `${inc.id}:arc${i}`;
          keepA.add(aid);
          const isAttack = seg.kind === 'attack';
          outArcs.push(upsert(arcs.current, aid,
            () => ({
              id: aid, incidentId: inc.id,
              startLat: seg.from.lat, startLng: seg.from.lng, endLat: seg.to.lat, endLng: seg.to.lng,
              color: isAttack ? [withAlpha(meta.glow, 0.15), withAlpha(meta.glow, 0.95)] : [withAlpha(meta.glow, 0.9), withAlpha(meta.glow, 0.25)],
              stroke: isSelected ? 0.6 : 0.35 + sev.rank * 0.08,
              dashLength: isAttack ? 0.25 : 0.4, dashGap: isAttack ? 0.15 : 0.2,
              dashAnimateTime: reducedMotion ? 0 : isAttack ? 1400 : 2600,
              altitude: arcAltitudeFor(seg.from, seg.to),
              label: seg.label ?? '',
            }),
            (d) => { d.stroke = isSelected ? 0.6 : 0.35 + sev.rank * 0.08; d.dashAnimateTime = reducedMotion ? 0 : isAttack ? 1400 : 2600; }));
        });
      }

      if (inc.cable) {
        const cid = `${inc.id}:cable`;
        keepPa.add(cid);
        const dim = status === 'resolved' ? 0.35 : 0.9;
        outPaths.push(upsert(paths.current, cid,
          () => ({
            id: cid, incidentId: inc.id,
            points: inc.cable!.landings.map((l) => [l.lat, l.lng] as [number, number]),
            color: [withAlpha(meta.glow, dim), withAlpha('#fde68a', dim)],
            stroke: isSelected ? 1.1 : 0.7,
            dashLength: 0.02, dashGap: 0.012, dashAnimateTime: reducedMotion ? 0 : 12000,
            label: `<div class="tt-title">${esc(inc.cable!.name)}</div><div class="tt-meta">${esc(inc.cable!.owners)} · ${inc.cable!.lengthKm.toLocaleString()} km</div>`,
          }),
          (d) => { d.stroke = isSelected ? 1.1 : 0.7; d.color = [withAlpha(meta.glow, dim), withAlpha('#fde68a', dim)]; }));
      }

      if (findCountry && status !== 'resolved' && inc.type !== 'cable_cut' && !inc.aggregated) {
        const feat = findCountry(inc.location.lat, inc.location.lng);
        if (feat) {
          const prev = countryHits.get(feat.id);
          if (!prev) countryHits.set(feat.id, { feature: feat, type: inc.type, severityRank: sev.rank, incidentId: inc.id, count: 1 });
          else {
            prev.count += 1;
            if (sev.rank > prev.severityRank) { prev.type = inc.type; prev.severityRank = sev.rank; prev.incidentId = inc.id; }
          }
        }
      }
    }

    for (const [id, hit] of countryHits) {
      keepPo.add(id);
      const c = TYPE_META[hit.type].glow;
      outPolys.push(upsert(polygons.current, id,
        () => ({ id, geometry: hit.feature.geometry, color: withAlpha(c, 0.05 + hit.severityRank * 0.02), stroke: withAlpha(c, 0.5), tint: c, label: hit.feature.name, incidentId: hit.incidentId, count: hit.count }),
        (d) => { d.color = withAlpha(c, 0.05 + hit.severityRank * 0.02); d.stroke = withAlpha(c, 0.5); d.tint = c; d.incidentId = hit.incidentId; d.count = hit.count; }));
    }

    if (you && you.lat != null && you.lng != null) {
      keepP.add('you');
      const label = `<div class="tt-title">You · ${you.asn ? `AS${you.asn}` : 'unknown ASN'}</div><div class="tt-meta">${esc(you.holder ?? '')}${you.city ? `, ${esc(you.city)}` : ''}${you.country ? `, ${esc(you.country)}` : ''}</div>`;
      outPoints.push(upsert(points.current, 'you',
        () => ({ id: 'you', incidentId: 'you', kind: 'you' as MarkerKind, lat: you.lat!, lng: you.lng!, color: '#4ade80', radius: 0.3, altitude: 0.04, type: null, label }),
        (d) => { d.lat = you.lat!; d.lng = you.lng!; d.label = label; }));
      if (!reducedMotion) {
        keepR.add('you');
        outRings.push(upsert(rings.current, 'you',
          () => ({ id: 'you', lat: you.lat!, lng: you.lng!, color: '#4ade80', maxR: 3, speed: 2, period: 1800 }),
          (d) => { d.lat = you.lat!; d.lng = you.lng!; }));
      }
    }

    prune(points.current, keepP);
    prune(rings.current, keepR);
    prune(arcs.current, keepA);
    prune(paths.current, keepPa);
    prune(polygons.current, keepPo);

    return { points: outPoints, rings: outRings, arcs: outArcs, paths: outPaths, polygons: outPolys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, opts.t, opts.selectedId, opts.hoveredId, opts.you, opts.affectedByYou, opts.findCountry, opts.reducedMotion]);
}
