'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui';

/**
 * Boot screen shown while the globe chunk and textures load. Fades out once globe.gl reports
 * ready and unmounts after the transition.
 */
export default function BootOverlay({ ready, incidentCount }: { ready: boolean; incidentCount: number }) {
  const [gone, setGone] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink-950 transition-opacity duration-500 ${ready ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="status" aria-live="polite">
      <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-panel border border-slate-700/60 bg-ink-800 text-accent motion-safe:animate-livePulse">
        <Icon name="eye" className="h-7 w-7" />
      </span>
      <div className="text-lg font-semibold tracking-tight">NetEye</div>
      <div className="mt-1 text-xs text-slate-400">Loading the globe. {incidentCount ? `${incidentCount} incidents ready.` : 'Fetching the incident feed.'}</div>
      {slow && !ready && <div className="mt-4 max-w-xs text-center text-[11px] text-slate-400">Still loading. The textures are about 2 MB on a first visit. If nothing appears, WebGL may be disabled in this browser.</div>}
    </div>
  );
}
