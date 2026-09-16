'use client';

/**
 * The 3D globe. A thin wrapper around react-globe.gl with a plain data contract
 * (points / rings / arcs / paths / polygons — see OutageMarker.tsx) so the rest of the app
 * never touches Three.js, and the renderer could be swapped behind this file.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import type { ArcDatum, GlobeLayers, PathDatum, PointDatum, PolygonDatum, RingDatum } from './OutageMarker';
import { withAlpha } from '@/app/utils/theme';

const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false });

export interface Pov {
  lat: number;
  lng: number;
  altitude: number;
}

export interface Focus extends Partial<Pov> {
  lat: number;
  lng: number;
  /** Transition length in ms. */
  ms?: number;
  /** Bump to re-trigger a fly-to with identical coordinates. */
  key: number;
}

export interface GlobeLabel {
  lat: number;
  lng: number;
  text: string;
  color: string;
}

export interface GlobeViewProps extends GlobeLayers {
  focus: Focus | null;
  initialPov: Pov | null;
  autoRotate: boolean;
  label: GlobeLabel | null;
  onSelect: (incidentId: string | null) => void;
  onHover: (incidentId: string | null) => void;
  onReady: () => void;
  onPovChange?: (pov: Pov) => void;
}

const DEFAULT_POV: Pov = { lat: 22, lng: 12, altitude: 2.3 };
const IDLE_RESUME_MS = 6000;

export default function Globe({
  points, rings, arcs, paths, polygons, focus, initialPov, autoRotate, label, onSelect, onHover, onReady, onPovChange,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const interacting = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const povTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  // The permalink camera can arrive before or after the globe is ready; apply it exactly once.
  const initialPovRef = useRef(initialPov);
  initialPovRef.current = initialPov;
  const initialPovApplied = useRef(false);

  // Track the container size so the canvas always fills it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const applyAutoRotate = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = autoRotateRef.current && !interacting.current;
  }, []);

  useEffect(applyAutoRotate, [autoRotate, ready, applyAutoRotate]);

  const readyOnce = useRef(false);
  const handleReady = useCallback(() => {
    const g = globeRef.current;
    if (!g || readyOnce.current) return; // idempotent: the watchdog and the real event may both fire
    readyOnce.current = true;
    const controls = g.controls();
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 0.7;
    controls.rotateSpeed = 0.6;
    controls.minDistance = 125; // globe radius is 100 → altitude 0.25
    controls.maxDistance = 520;
    controls.enablePan = false;

    // Pause auto-rotation while the user is dragging, resume after a quiet spell.
    controls.addEventListener('start', () => {
      interacting.current = true;
      controls.autoRotate = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    });
    controls.addEventListener('end', () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        interacting.current = false;
        applyAutoRotate();
      }, IDLE_RESUME_MS);
    });

    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    g.pointOfView(initialPovRef.current ?? DEFAULT_POV, 0);
    if (initialPovRef.current) initialPovApplied.current = true;
    setReady(true);
    onReady();
  }, [applyAutoRotate, onReady]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready || !initialPov || initialPovApplied.current) return;
    initialPovApplied.current = true;
    g.pointOfView(initialPov, 0);
  }, [ready, initialPov]);

  // Watchdog: if the globe instance exists but never reported ready (e.g. a hot reload replaced
  // the instance mid-load), lift the boot screen anyway so the app is never stuck behind it.
  useEffect(() => {
    if (ready || size.width === 0) return;
    const id = setTimeout(() => {
      if (!ready && globeRef.current) handleReady();
    }, 8000);
    return () => clearTimeout(id);
  }, [ready, size.width, handleReady]);

  // Fly-to requests.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready || !focus) return;
    const current = g.pointOfView();
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude ?? Math.min(current.altitude, 1.5) }, focus.ms ?? 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, ready]);

  // Save GPU when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      const g = globeRef.current;
      if (!g) return;
      if (document.hidden) g.pauseAnimation();
      else g.resumeAnimation();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const handleZoom = useCallback((pov: Pov) => {
    if (!onPovChange) return;
    if (povTimer.current) clearTimeout(povTimer.current);
    povTimer.current = setTimeout(() => onPovChange(pov), 400);
  }, [onPovChange]);

  // Stable accessors (function identity matters to globe.gl's prop diffing).
  const ringColor = useCallback((d: object) => (t: number) => withAlpha((d as RingDatum).color, Math.max(0, 1 - t) * 0.85), []);
  const pathLat = useCallback((p: [number, number]) => p[0], []);
  const pathLng = useCallback((p: [number, number]) => p[1], []);
  const transparent = useCallback(() => 'rgba(0,0,0,0)', []);
  const pointClick = useCallback((p: object) => {
    const d = p as PointDatum;
    onSelect(d.kind === 'you' ? null : d.incidentId);
  }, [onSelect]);
  const pointHover = useCallback((p: object | null) => {
    const d = p as PointDatum | null;
    onHover(d && d.kind !== 'you' ? d.incidentId : null);
  }, [onHover]);
  const arcClick = useCallback((a: object) => onSelect((a as ArcDatum).incidentId), [onSelect]);
  const pathClick = useCallback((p: object) => onSelect((p as PathDatum).incidentId), [onSelect]);
  const globeClick = useCallback(() => onSelect(null), [onSelect]);
  const polygonLabel = useCallback((d: object) => `<div class="tt-title">${(d as PolygonDatum).label}</div><div class="tt-meta">Country with active incidents</div>`, []);

  return (
    <div ref={containerRef} className="absolute inset-0 select-none" aria-label="Interactive globe of internet incidents" role="img">
      {size.width > 0 && (
        <GlobeGL
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeImageUrl="/earth-night.jpg"
          bumpImageUrl="/earth-topology.png"
          backgroundImageUrl="/night-sky.png"
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#aab3c2"
          atmosphereAltitude={0.15}
          rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onGlobeReady={handleReady}
          onGlobeClick={globeClick}
          onZoom={handleZoom}
          // points ------------------------------------------------------------
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="radius"
          pointAltitude="altitude"
          pointResolution={10}
          pointsMerge={false}
          pointsTransitionDuration={350}
          pointLabel="label"
          onPointClick={pointClick}
          onPointHover={pointHover}
          // rings -------------------------------------------------------------
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={ringColor}
          ringMaxRadius="maxR"
          ringPropagationSpeed="speed"
          ringRepeatPeriod="period"
          ringAltitude={0.004}
          ringResolution={48}
          // arcs --------------------------------------------------------------
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcStroke="stroke"
          arcAltitude="altitude"
          arcDashLength="dashLength"
          arcDashGap="dashGap"
          arcDashAnimateTime="dashAnimateTime"
          arcsTransitionDuration={700}
          arcLabel="label"
          onArcClick={arcClick}
          // paths (cables) ------------------------------------------------------
          pathsData={paths}
          pathPoints="points"
          pathPointLat={pathLat}
          pathPointLng={pathLng}
          pathPointAlt={0.003}
          pathColor="color"
          pathStroke="stroke"
          pathDashLength="dashLength"
          pathDashGap="dashGap"
          pathDashAnimateTime="dashAnimateTime"
          pathTransitionDuration={0}
          pathLabel="label"
          onPathClick={pathClick}
          // polygons (affected countries) --------------------------------------
          polygonsData={polygons}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor="color"
          polygonSideColor={transparent}
          polygonStrokeColor="stroke"
          polygonAltitude={0.005}
          polygonsTransitionDuration={400}
          polygonLabel={polygonLabel}
          // selected label -------------------------------------------------------
          labelsData={label ? [label] : []}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelColor="color"
          labelSize={0.75}
          labelAltitude={0.06}
          labelResolution={2}
          labelIncludeDot={false}
          labelsTransitionDuration={0}
        />
      )}
    </div>
  );
}
