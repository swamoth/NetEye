'use client';

/**
 * Circular "machined dial" surface: a dark disc inside a liquid-metal ring.
 *
 * The ring is drawn by metal-fx (WebGL2, one shared context for every instance on the page,
 * chromatic preset) and dents towards the cursor via useMetalBend. Before hydration, without
 * WebGL2, or when the OS asks for reduced motion, the pure-CSS `.metal-btn` ring renders
 * instead, so the mark is identical in shape and only loses the shimmer.
 *
 * Wrap it in the interactive element (button / a) and pass the icon as children.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MetalFx, isMetalFxSupported, useMetalBend } from 'metal-fx';
import { useReducedMotion } from '@/app/hooks/useReducedMotion';

const METAL_BASELINE = 32; // px at which metal-fx's circle preset is tuned

export interface MetalSurfaceProps {
  /** Outer diameter in px. */
  size?: number;
  /** Icon colour: soft grey by default, white for the brand mark. */
  tone?: 'soft' | 'bright';
  /** Freeze the shader (also implied by prefers-reduced-motion). */
  paused?: boolean;
  /**
   * Halo strength (0..1). metal-fx's wandering catch-light is tuned for 40px+ buttons; at our
   * 32px it reads as a white blob on one side of the ring, so the default is well below 1.
   */
  glow?: number;
  className?: string;
  children: ReactNode;
}

export default function MetalSurface({ size = 36, tone = 'soft', paused = false, glow = 0.35, className = '', children }: MetalSurfaceProps) {
  const root = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const reduced = useReducedMotion();
  useMetalBend(root);

  useEffect(() => {
    setLive(isMetalFxSupported());
  }, []);

  const icon = (
    <span
      className={`grid place-items-center rounded-full transition-colors duration-200 ease-house ${tone === 'bright' ? 'text-fg' : 'text-fg-soft group-hover:text-fg'}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );

  if (!live) {
    return (
      <span className={`metal-btn ${className}`} style={{ width: size, height: size }}>
        {icon}
      </span>
    );
  }

  return (
    <MetalFx
      ref={root}
      preset="chromatic"
      variant="circle"
      theme="dark"
      innerShadow
      glowGain={glow}
      paused={paused || reduced}
      scale={size / METAL_BASELINE}
      className={`metal-live rounded-full ${className}`}
    >
      {icon}
    </MetalFx>
  );
}
