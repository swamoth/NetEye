'use client';

/**
 * Minimal 2D-canvas animation loop: DPR-aware sizing via ResizeObserver, optional fps cap,
 * optional pointer tracking, and a single static frame when the OS asks for reduced motion.
 *
 * Adapted from Ege Chelebi's blog (github.com/woosal1337/blog, MIT).
 */

import { useEffect, useRef, type RefObject } from 'react';

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds since the loop started. */
  time: number;
  /** Seconds since the previous frame, capped. */
  dt: number;
  pointer: { x: number; y: number; inside: boolean };
}

export interface CanvasAnimationOptions {
  /** 0 = every animation frame. */
  fps?: number;
  /** Track the mouse relative to the canvas (window-level, passive). */
  reactive?: boolean;
}

export function useCanvasAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  hostRef: RefObject<HTMLElement | null>,
  draw: (frame: CanvasFrame) => void,
  { fps = 0, reactive = false }: CanvasAnimationOptions = {},
) {
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0, height = 0, start = 0, last = 0, lastDraw = 0;
    const frameMs = fps > 0 ? 1000 / fps : 0;
    const pointer = { inside: false, x: -9999, y: -9999 };
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;
      if (reduceMotion) drawRef.current({ ctx, dt: 0, height, pointer, time: 0, width });
    };

    const loop = (ts: number) => {
      if (!start) { start = ts; last = ts; }
      if (frameMs && ts - lastDraw < frameMs) { raf = requestAnimationFrame(loop); return; }
      if (width === 0 || height === 0) resize();
      const time = (ts - start) / 1000;
      const dt = Math.min(0.064, (ts - last) / 1000);
      last = ts;
      lastDraw = ts;
      drawRef.current({ ctx, dt, height, pointer, time, width });
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.inside = pointer.x >= -24 && pointer.x <= rect.width + 24 && pointer.y >= -24 && pointer.y <= rect.height + 24;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    if (reactive) window.addEventListener('mousemove', onMove, { passive: true });
    if (!reduceMotion) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (reactive) window.removeEventListener('mousemove', onMove);
    };
  }, [canvasRef, hostRef, fps, reactive]);
}
