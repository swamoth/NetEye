'use client';

import { useEffect, useState } from 'react';
import type { CountryFeature } from '@/app/hooks/useGeoData';
import { buildDotEarthTexture } from '@/app/utils/dotEarth';

/** If the polygons have not arrived by then, ship a plain sphere rather than block the globe. */
const FALLBACK_MS = 8000;

/**
 * The globe surface as an object URL, built once the country polygons are in. `url` stays null
 * until a texture exists; the globe waits for it so the boot screen never shows a bare sphere.
 */
export function useDotEarth(countries: CountryFeature[]): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    const build = (list: CountryFeature[]) =>
      buildDotEarthTexture(list)
        .then((u) => {
          if (cancelled) { URL.revokeObjectURL(u); return; }
          made = u;
          setUrl(u);
        })
        .catch(() => { /* leave the previous texture in place */ });

    if (countries.length) {
      void build(countries);
      return () => {
        cancelled = true;
        if (made) URL.revokeObjectURL(made);
      };
    }
    const id = setTimeout(() => void build([]), FALLBACK_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
      if (made) URL.revokeObjectURL(made);
    };
  }, [countries]);

  return url;
}
