'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { pointInPolygon } from '@/app/utils/coordinates';

export interface CountryFeature {
  id: string;
  name: string;
  geometry: Polygon | MultiPolygon;
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
}

function bboxOf(geometry: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

let cached: CountryFeature[] | null = null;
let inflight: Promise<CountryFeature[]> | null = null;

/** Load Natural Earth 1:110m country polygons (TopoJSON from world-atlas, served from /public). */
async function loadCountries(): Promise<CountryFeature[]> {
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
      const [{ feature }, res] = await Promise.all([import('topojson-client'), fetch('/data/countries-110m.json')]);
      const topo = await res.json();
      const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
      const list: CountryFeature[] = [];
      for (const f of fc.features as Feature<Geometry, { name: string }>[]) {
        if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
        list.push({ id: String(f.id), name: f.properties?.name ?? String(f.id), geometry: f.geometry, bbox: bboxOf(f.geometry) });
      }
      cached = list;
      return list;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

export interface GeoData {
  countries: CountryFeature[];
  ready: boolean;
  /** Country polygon containing the point, if any (bbox pre-filter + ray casting). */
  findCountry: (lat: number, lng: number) => CountryFeature | undefined;
  byName: Map<string, CountryFeature>;
}

export function useGeoData(): GeoData {
  const [countries, setCountries] = useState<CountryFeature[]>(cached ?? []);

  useEffect(() => {
    let cancelled = false;
    loadCountries().then((list) => { if (!cancelled) setCountries(list); }).catch(() => { /* polygons are decorative */ });
    return () => { cancelled = true; };
  }, []);

  const findCountry = useCallback(
    (lat: number, lng: number) => {
      for (const c of countries) {
        const [minX, minY, maxX, maxY] = c.bbox;
        if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
        const polys = c.geometry.type === 'Polygon' ? [c.geometry.coordinates] : c.geometry.coordinates;
        for (const poly of polys) if (pointInPolygon({ lat, lng }, poly)) return c;
      }
      return undefined;
    },
    [countries],
  );

  const byName = useMemo(() => new Map(countries.map((c) => [c.name.toLowerCase(), c])), [countries]);

  return { countries, ready: countries.length > 0, findCountry, byName };
}
