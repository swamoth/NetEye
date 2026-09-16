'use client';

import { useEffect, useState } from 'react';
import type { CountryFeature } from '@/app/hooks/useGeoData';
import AsciiWorld from './AsciiWorld';

/**
 * Boot screen shown while the globe chunk loads and the dotted surface is painted: the world in ASCII from the
 * same land polygons the globe will render, a thin ring loader and a mono status line. Fades
 * out once globe.gl reports ready and unmounts after the transition.
 */
export default function BootOverlay({ ready, incidentCount, countries }: { ready: boolean; incidentCount: number; countries: CountryFeature[] }) {
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setGone(true), 600);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div
      className={`absolute inset-0 z-40 bg-well transition-opacity duration-[600ms] ease-house ${ready ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      role="status"
      aria-live="polite"
    >
      <AsciiWorld countries={countries} className="absolute inset-x-0 top-[8%] mx-auto h-[min(50vh,520px)] w-[min(94vw,1180px)]" />

      <div className="absolute inset-x-0 bottom-[16%] flex flex-col items-center px-6 text-center">
        <span className="ring-loader" aria-hidden />
        <div className="mt-5 text-[15px] font-medium tracking-[-0.01em] text-fg">NetEye</div>
        <div className="mt-1 font-mono text-[11px] text-fg-mute">
          loading the globe · {incidentCount ? `${incidentCount} incidents ready` : 'fetching the incident feed'}
        </div>
        {slow && !ready && (
          <div className="mt-4 max-w-xs font-mono text-[10.5px] leading-relaxed text-fg-mute">
            still loading. the 3D engine is about 1 MB on a first visit. if nothing appears, WebGL may be disabled in this browser.
          </div>
        )}
      </div>
    </div>
  );
}
