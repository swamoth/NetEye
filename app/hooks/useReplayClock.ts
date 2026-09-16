'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [1, 10, 60, 300] as const;
export type Speed = (typeof SPEEDS)[number];

export interface ReplayClock {
  /** Effective view time (ms): the replay position, or wall-clock when live. */
  t: number;
  /** Wall-clock now (ticks every second). */
  now: number;
  isLive: boolean;
  viewTime: number | null;
  playing: boolean;
  speed: Speed;
  setViewTime: (ms: number | null) => void;
  setPlaying: (p: boolean) => void;
  togglePlaying: () => void;
  setSpeed: (s: Speed) => void;
  goLive: () => void;
}

const TICK_MS = 100;

/**
 * Replay clock for the 24h timeline. `viewTime === null` means "live". While playing, the view
 * time advances at `speed`× real time (updated 10×/s — enough for markers, cheap for React) and
 * snaps back to live when it catches up with the present.
 *
 * @param initialNow  Server timestamp of the SSR snapshot. Using it for the first render keeps the
 *                    server and client HTML identical (no hydration mismatch); the 1 s ticker takes
 *                    over immediately after mount.
 */
export function useReplayClock(initialNow?: number, initialViewTime: number | null = null): ReplayClock {
  const [now, setNow] = useState(() => initialNow ?? Date.now());
  const [viewTime, setViewTimeState] = useState<number | null>(initialViewTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(60);
  const lastTick = useRef<number>(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!playing || viewTime == null) return;
    lastTick.current = performance.now();
    const id = setInterval(() => {
      const ts = performance.now();
      const dt = ts - lastTick.current;
      lastTick.current = ts;
      setViewTimeState((v) => {
        if (v == null) return v;
        const next = v + dt * speed;
        if (next >= Date.now()) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, viewTime == null]);

  const setViewTime = useCallback((ms: number | null) => {
    if (ms == null || ms >= Date.now()) {
      setViewTimeState(null);
      setPlaying(false);
    } else {
      setViewTimeState(ms);
    }
  }, []);

  const goLive = useCallback(() => {
    setViewTimeState(null);
    setPlaying(false);
  }, []);

  const togglePlaying = useCallback(() => {
    setPlaying((p) => {
      if (!p && viewTime == null) {
        // Pressing play while live: rewind 24h and play forward.
        setViewTimeState(Date.now() - 24 * 60 * 60 * 1000);
      }
      return !p;
    });
  }, [viewTime]);

  return {
    t: viewTime ?? now,
    now,
    isLive: viewTime == null,
    viewTime,
    playing,
    speed,
    setViewTime,
    setPlaying,
    togglePlaying,
    setSpeed,
    goLive,
  };
}
