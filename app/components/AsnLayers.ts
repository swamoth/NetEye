'use client';

/**
 * Globe layers for the ASN explorer: the network's home marker, arcs to its top neighbours,
 * and short-lived arcs for live BGP updates drawn from the RIS collector that observed them.
 * Same identity-preserving pattern as OutageMarker.ts.
 */

import { useMemo, useRef } from 'react';
import type { AsnProfile } from '@/app/utils/types';
import type { RisLiveState } from '@/app/hooks/useRisLive';
import { ACCENT, STATUS_META, withAlpha } from '@/app/utils/theme';
import { arcAltitudeFor } from '@/app/utils/coordinates';
import { NEIGHBOUR_COLOR } from './AsnExplorer';
import { esc, prune, upsert, type ArcDatum, type GlobeLayers, type PointDatum, type RingDatum } from './OutageMarker';

const LIVE_ARC_TTL_MS = 3000;

export function useAsnLayers(profile: AsnProfile | null, ris: RisLiveState, watching: boolean, now: number, reducedMotion: boolean): Pick<GlobeLayers, 'points' | 'arcs' | 'rings'> {
  const points = useRef(new Map<string, PointDatum>());
  const arcs = useRef(new Map<string, ArcDatum>());
  const rings = useRef(new Map<string, RingDatum>());

  return useMemo(() => {
    const outP: PointDatum[] = [];
    const outA: ArcDatum[] = [];
    const outR: RingDatum[] = [];
    const keepP = new Set<string>(), keepA = new Set<string>(), keepR = new Set<string>();
    const home = profile?.location;

    if (profile && home) {
      const hid = `asn:${profile.asn}`;
      keepP.add(hid);
      const label = `<div class="tt-title">AS${profile.asn}${profile.name ? ` · ${esc(profile.name)}` : ''}</div><div class="tt-meta">${esc([home.city, home.country].filter(Boolean).join(', '))}</div>`;
      outP.push(upsert(points.current, hid,
        () => ({ id: hid, incidentId: String(profile.asn), kind: 'asn', lat: home.lat, lng: home.lng, color: ACCENT, radius: 0.42, altitude: 0.06, type: null, label }),
        (d) => { d.lat = home.lat; d.lng = home.lng; d.label = label; }));
      if (!reducedMotion) {
        keepR.add(hid);
        outR.push(upsert(rings.current, hid, () => ({ id: hid, lat: home.lat, lng: home.lng, color: ACCENT, maxR: 2.6, speed: 1.6, period: 2000 }), () => {}));
      }

      for (const n of profile.neighbours.top.slice(0, 10)) {
        if (!n.location) continue;
        // A neighbour placed at the same point as home would produce a zero-length arc.
        if (Math.abs(n.location.lat - home.lat) < 0.05 && Math.abs(n.location.lng - home.lng) < 0.05) continue;
        const nid = `asn:${profile.asn}:n:${n.asn}`;
        keepP.add(nid);
        keepA.add(nid);
        const color = NEIGHBOUR_COLOR[n.type];
        const nlabel = `<div class="tt-title">AS${n.asn}${n.name ? ` · ${esc(n.name)}` : ''}</div><div class="tt-meta">${n.type} neighbour of AS${profile.asn}${n.location.name ? `, ${esc(String(n.location.name))}` : ''}</div>`;
        outP.push(upsert(points.current, nid,
          () => ({ id: nid, incidentId: String(n.asn), kind: 'neighbour', lat: n.location!.lat, lng: n.location!.lng, color: withAlpha(color, 0.9), radius: 0.2, altitude: 0.012, type: null, label: nlabel }),
          (d) => { d.label = nlabel; }));
        const up = n.type === 'upstream';
        outA.push(upsert(arcs.current, nid,
          () => ({
            id: nid, incidentId: String(n.asn),
            startLat: up ? home.lat : n.location!.lat, startLng: up ? home.lng : n.location!.lng,
            endLat: up ? n.location!.lat : home.lat, endLng: up ? n.location!.lng : home.lng,
            color: [withAlpha(color, 0.85), withAlpha(color, 0.25)],
            stroke: 0.3, dashLength: 0.35, dashGap: 0.2, dashAnimateTime: reducedMotion ? 0 : 3200, altitude: arcAltitudeFor(home, n.location!),
            label: `AS${profile.asn} ${up ? '→' : '←'} AS${n.asn}`,
          }),
          (d) => { d.dashAnimateTime = reducedMotion ? 0 : 3200; }));
      }

      // Live updates: one short-lived arc per message from the observing collector.
      if (watching) {
        for (const u of ris.updates) {
          if (!u.collector || now - u.ts > LIVE_ARC_TTL_MS) continue;
          const aid = `ris:${u.id}`;
          keepA.add(aid);
          const withdrawal = u.withdrawn.length > 0 && u.announced.length === 0;
          const color = withdrawal ? STATUS_META.active.color : STATUS_META.resolved.color;
          outA.push(upsert(arcs.current, aid,
            () => ({
              id: aid, incidentId: String(profile.asn),
              startLat: u.collector!.lat, startLng: u.collector!.lng, endLat: home.lat, endLng: home.lng,
              color: [withAlpha(color, 0.95), withAlpha(color, 0.2)],
              stroke: 0.45, dashLength: 0.6, dashGap: 0.4, dashAnimateTime: reducedMotion ? 0 : 1200, altitude: arcAltitudeFor(u.collector!, home),
              label: `${withdrawal ? 'Withdrawal' : 'Announcement'} seen at ${esc(u.collector!.city)} via AS${u.peerAsn}`,
            }),
            () => {}));
        }
      }
    }

    prune(points.current, keepP);
    prune(arcs.current, keepA);
    prune(rings.current, keepR);
    return { points: outP, arcs: outA, rings: outR };
  }, [profile, ris.updates, watching, now, reducedMotion]);
}
