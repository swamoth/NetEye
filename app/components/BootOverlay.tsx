'use client';

import { useEffect, useState } from 'react';
import type { CountryFeature } from '@/app/hooks/useGeoData';
import AsciiWorld from './AsciiWorld';
import MetalSurface from './MetalSurface';
import { Icon } from './ui';

/**
 * Boot screen: the world in ASCII from the same land polygons the globe renders, a ring loader
 * while the globe chunk loads and the surface is painted, then an Enter button. The ASCII field
 * follows the pointer, so the screen is something to play with rather than a wait. A deep link
 * (`gate` false) skips the button and fades straight through once the globe is ready.
 */
export default function BootOverlay({ ready, incidentCount, countries, gate }: { ready: boolean; incidentCount: number; countries: CountryFeature[]; gate: boolean }) {
  const [entered, setEntered] = useState(false);
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);
  const leaving = ready && (entered || !gate);
  const showEnter = ready && gate && !entered;

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => setGone(true), 600);
    return () => clearTimeout(id);
  }, [leaving]);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!showEnter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') setEntered(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEnter]);

  if (gone) return null;

  return (
    <div
      className={`absolute inset-0 z-40 bg-well transition-opacity duration-[600ms] ease-house ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      role={showEnter ? undefined : 'status'}
      aria-live="polite"
    >
      <AsciiWorld countries={countries} className="absolute inset-x-0 top-[8%] mx-auto h-[min(50vh,520px)] w-[min(94vw,1180px)]" />

      <div className="absolute inset-x-0 bottom-[16%] flex flex-col items-center px-6 text-center">
        {showEnter ? (
          <button type="button" className="group press rounded-full" onClick={() => setEntered(true)} autoFocus aria-label="Enter NetEye">
            <MetalSurface size={48} tone="bright" glow={0.6}>
              <Icon name="arrow-right" className="h-[19px] w-[19px]" />
            </MetalSurface>
          </button>
        ) : (
          <span className="ring-loader" aria-hidden />
        )}
        <div className="mt-5 text-[15px] font-medium tracking-[-0.01em] text-fg">NetEye</div>
        <div className="mt-1 font-mono text-[11px] text-fg-mute">
          {showEnter ? (
            <>press <span className="kbd">enter</span> · {incidentCount ? `${incidentCount} incidents ready` : 'no incidents in the feed'}</>
          ) : (
            <>loading the globe · {incidentCount ? `${incidentCount} incidents ready` : 'fetching the incident feed'}</>
          )}
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
