'use client';

import { useMemo } from 'react';
import type { Incident, IncidentType } from '@/app/utils/types';
import { TYPE_META, TYPE_ORDER } from '@/app/utils/theme';
import { DAY_MS, HOUR_MS, histogram } from '@/app/utils/incidents';
import { formatRelative, formatUtcDateTime, formatUtcTime } from '@/app/utils/format';
import type { ReplayClock } from '@/app/hooks/useReplayClock';
import { SPEEDS } from '@/app/hooks/useReplayClock';
import { Dot, Icon } from './ui';
import MetalSurface from './MetalSurface';

export interface TimelineProps {
  incidents: Incident[];
  coveredTypes: Set<IncidentType>;
  clock: ReplayClock;
}

const BINS = 48;

export default function Timeline({ incidents, coveredTypes, clock }: TimelineProps) {
  const { now, t, isLive, playing, speed } = clock;
  const from = now - DAY_MS;
  const bins = useMemo(() => histogram(incidents, from, now, BINS), [incidents, from, now]);
  const max = useMemo(() => Math.max(1, ...bins.map((b) => TYPE_ORDER.reduce((s, k) => s + b[k], 0))), [bins]);
  const progress = Math.max(0, Math.min(1, (t - from) / DAY_MS));
  const legendTypes = TYPE_ORDER.filter((k) => coveredTypes.has(k));

  const tickLabels = useMemo(() => {
    const out: { pct: number; label: string }[] = [];
    const firstHour = Math.ceil(from / HOUR_MS) * HOUR_MS;
    for (let h = firstHour; h <= now; h += HOUR_MS) {
      if (new Date(h).getUTCHours() % 6 === 0) out.push({ pct: ((h - from) / DAY_MS) * 100, label: formatUtcTime(h, false) });
    }
    return out;
  }, [from, now]);

  return (
    <section className="bar pointer-events-auto absolute bottom-3 left-1/2 z-20 w-[min(960px,calc(100vw-1.5rem))] -translate-x-1/2 px-3 pb-2 pt-2 md:bottom-4" aria-label="24 hour timeline and replay controls">
      <div className="flex items-center gap-2">
        <button type="button" className="btn !px-2 font-mono" title="Back one hour" onClick={() => clock.setViewTime(Math.max(from, t - HOUR_MS))}>
          <span className="tnum text-[11px]">-1h</span>
        </button>
        <button
          type="button"
          className="group press rounded-full"
          title={playing ? 'Pause replay' : isLive ? 'Replay the last 24 hours' : 'Play from here'}
          aria-pressed={playing}
          onClick={clock.togglePlaying}
        >
          <MetalSurface size={32} tone={playing ? 'bright' : 'soft'}>
            <Icon name={playing ? 'pause' : 'play'} className="h-3.5 w-3.5" label={playing ? 'Pause' : 'Play'} />
          </MetalSurface>
        </button>
        <button type="button" className="btn !px-2 font-mono" title="Forward one hour" onClick={() => clock.setViewTime(t + HOUR_MS)} disabled={isLive}>
          <span className="tnum text-[11px]">+1h</span>
        </button>
        <div className="hidden items-center gap-0.5 rounded-full border border-line p-0.5 sm:flex" role="group" aria-label="Replay speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`tnum rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors duration-200 ease-house ${speed === s ? 'bg-white/[0.08] text-fg' : 'text-fg-mute hover:text-fg'}`}
              aria-pressed={speed === s}
              onClick={() => clock.setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="ml-2 hidden items-center gap-3 font-mono text-[10px] text-fg-mute lg:flex" aria-label="Legend">
          {legendTypes.map((k) => (
            <span key={k} className="inline-flex items-center gap-1"><Dot color={TYPE_META[k].color} className="h-1.5 w-1.5" />{TYPE_META[k].label.toLowerCase()}</span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px]">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-fg">
              <Dot color="#34d399" className="motion-safe:animate-livePulse" />
              Live <span className="tnum font-mono text-[10.5px] text-fg-mute">{formatUtcTime(now, false)} UTC</span>
            </span>
          ) : (
            <>
              <time className="tnum font-mono text-[10.5px] text-fg" dateTime={new Date(t).toISOString()}>{formatUtcDateTime(t)}</time>
              <span className="font-mono text-[10.5px] text-fg-mute">({formatRelative(t, now)})</span>
              <button type="button" className="btn !py-1" onClick={clock.goLive} title="Return to live">
                <Icon name="live" className="h-3.5 w-3.5" /> Go live
              </button>
            </>
          )}
        </div>
      </div>

      {/* histogram + scrubber */}
      <div className="relative mt-2 h-14">
        <div className="absolute inset-x-0 top-0 flex h-9 items-end gap-[2px] px-[7px]" aria-hidden>
          {bins.map((b, i) => {
            const total = TYPE_ORDER.reduce((s, k) => s + b[k], 0);
            const binStart = from + (i / BINS) * DAY_MS;
            const past = binStart <= t;
            return (
              <div key={i} className="flex max-w-[24px] flex-1 flex-col-reverse gap-[2px]" style={{ height: '100%', opacity: past ? 1 : 0.3 }} title={`${total} incident${total === 1 ? '' : 's'} starting ${formatUtcTime(binStart, false)} to ${formatUtcTime(binStart + DAY_MS / BINS, false)} UTC`}>
                {TYPE_ORDER.map((k, idx) => (b[k]
                  ? <div key={k} className={idx === TYPE_ORDER.findLastIndex((kk) => b[kk] > 0) ? 'rounded-t-[4px]' : ''} style={{ height: `calc(${(b[k] / max) * 100}% - 1px)`, background: TYPE_META[k].color, minHeight: 2 }} />
                  : null))}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-[7px] top-9 h-px bg-line" aria-hidden />
        <div className="pointer-events-none absolute top-0 h-9 w-px bg-fg/70" style={{ left: `calc(7px + ${progress} * (100% - 14px))` }} aria-hidden />
        <input
          type="range"
          className="scrubber absolute inset-x-0 top-9"
          min={from}
          max={now}
          step={60_000}
          value={Math.round(t)}
          onChange={(e) => clock.setViewTime(Number(e.target.value))}
          aria-label="Replay position"
          aria-valuetext={isLive ? 'Live' : formatUtcDateTime(t)}
        />
        <div className="tnum pointer-events-none absolute inset-x-0 top-[3.1rem] h-3 px-[7px] font-mono text-[9px] text-fg-mute" aria-hidden>
          {tickLabels.map((tk) => (
            <span key={tk.label} className="absolute -translate-x-1/2" style={{ left: `calc(7px + ${tk.pct / 100} * (100% - 14px))` }}>{tk.label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
