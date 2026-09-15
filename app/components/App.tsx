'use client';

/**
 * Client shell: owns UI state (filters, selection, replay time, ASN explorer, URL sync) and
 * composes the globe with the overlay panels. Data arrives via useOutages (SSR seed → WebSocket →
 * polling); the ASN explorer pulls RIPEstat/Radar through /api/asn and streams RIS Live directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Incident, IncidentType, Severity, Snapshot } from '@/app/utils/types';
import { INCIDENT_TYPES, SEVERITIES } from '@/app/utils/types';
import { DAY_MS, filterIncidents, isVisibleAt, sortIncidents, statusAt, summarize } from '@/app/utils/incidents';
import { TYPE_META, withAlpha } from '@/app/utils/theme';
import { downloadText, exportFilename, toCsv } from '@/app/utils/export';
import { altitudeForSpanKm, centroid, haversineKm } from '@/app/utils/coordinates';
import { useOutages } from '@/app/hooks/useOutages';
import { useReplayClock } from '@/app/hooks/useReplayClock';
import { useGeoData } from '@/app/hooks/useGeoData';
import { useReducedMotion } from '@/app/hooks/useReducedMotion';
import { useDotEarth } from '@/app/hooks/useDotEarth';
import { useWhoAmI } from '@/app/hooks/useWhoAmI';
import { useAsnProfile } from '@/app/hooks/useAsnProfile';
import { useRisLive } from '@/app/hooks/useRisLive';
import { currentShareUrl, EMPTY_URL_STATE, readUrlState, useUrlStateWriter, type UrlState } from '@/app/hooks/useUrlState';
import { CABLES } from '@/server/data/cables';
import Globe, { type Focus, type GlobeLabel, type Pov } from './Globe';
import { useGlobeLayers, type PathDatum } from './OutageMarker';
import { useAsnLayers } from './AsnLayers';
import Header from './Header';
import Dashboard from './Dashboard';
import OutageDetail from './OutageDetail';
import AsnExplorer from './AsnExplorer';
import Timeline from './Timeline';
import CommandPalette, { buildPaletteIndex } from './CommandPalette';
import BootOverlay from './BootOverlay';
import { Icon } from './ui';

export default function App({ initial }: { initial: Snapshot | null }) {
  const feed = useOutages(initial);
  const clock = useReplayClock(initial ? Date.parse(initial.now) : undefined);
  const geo = useGeoData();
  const earthTexture = useDotEarth(geo.countries);
  const who = useWhoAmI();
  const reducedMotion = useReducedMotion();

  // --- UI state --------------------------------------------------------------
  const [types, setTypes] = useState<Set<IncidentType>>(() => new Set(INCIDENT_TYPES));
  const [severities, setSeverities] = useState<Set<Severity>>(() => new Set(SEVERITIES));
  const [query, setQuery] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [asnOpen, setAsnOpen] = useState<number | null>(null);
  const [watchBgp, setWatchBgp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [initialPov, setInitialPov] = useState<Pov | null>(null);
  const [pov, setPov] = useState<Pov | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [extraCableId, setExtraCableId] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const focusKey = useRef(0);

  const profile = useAsnProfile(asnOpen);
  const ris = useRisLive(asnOpen, watchBgp && asnOpen != null);
  // Which ASN the camera has already flown to (reset on close so reopening flies again).
  const flownAsn = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const flyTo = useCallback((lat: number, lng: number, altitude?: number, ms?: number) => {
    focusKey.current += 1;
    setFocus({ lat, lng, altitude, ms, key: focusKey.current });
  }, []);

  // --- restore state from the URL (client only, after hydration) --------------
  useEffect(() => {
    const s = readUrlState();
    if (s.types) setTypes(new Set(s.types));
    if (s.sev) setSeverities(new Set(s.sev));
    if (s.q) setQuery(s.q);
    if (s.t != null) clock.setViewTime(s.t);
    if (s.incident) { setSelectedId(s.incident); setShowResolved(true); }
    if (s.asn) setAsnOpen(s.asn);
    if (s.pov) setInitialPov(s.pov);
    setUrlReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- derived data ------------------------------------------------------------
  const t = clock.t;
  const incidents = feed.incidents;
  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);

  const coveredTypes = useMemo(() => {
    const set = new Set<IncidentType>();
    for (const s of feed.sources) if (s.mode === 'live') for (const ty of s.coveredTypes) set.add(ty);
    for (const i of incidents) set.add(i.type);
    return set;
  }, [feed.sources, incidents]);

  const inWindow = useMemo(() => {
    const windowStart = t - DAY_MS;
    return incidents.filter((i) => {
      if (Date.parse(i.startedAt) > t) return false;
      const end = i.resolvedAt ? Date.parse(i.resolvedAt) : Infinity;
      return end >= windowStart;
    });
  }, [incidents, t]);

  const filtered = useMemo(() => filterIncidents(inWindow, { types, severities, q: query }), [inWindow, types, severities, query]);
  const visible = useMemo(() => filtered.filter((i) => isVisibleAt(i, t)), [filtered, t]);
  const list = useMemo(
    () => sortIncidents(filtered.filter((i) => { const s = statusAt(i, t); return s && (showResolved || s !== 'resolved'); }), t),
    [filtered, t, showResolved],
  );
  const summary = useMemo(() => summarize(inWindow, t), [inWindow, t]);

  const affectedByYou = useMemo(() => {
    const out = new Set<string>();
    const me = who.data;
    if (!me) return out;
    for (const i of inWindow) {
      if (me.asn && i.affectedASNs.some((a) => a.asn === me.asn)) out.add(i.id);
      else if (me.countryCode && i.location.countryCode === me.countryCode && !i.aggregated) out.add(i.id);
    }
    return out;
  }, [inWindow, who.data]);

  const asnIncidentCount = useMemo(() => (asnOpen ? inWindow.filter((i) => i.affectedASNs.some((a) => a.asn === asnOpen)).length : 0), [inWindow, asnOpen]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const globeLabel: GlobeLabel | null = useMemo(() => {
    if (asnOpen && profile.data?.location) {
      return { lat: profile.data.location.lat, lng: profile.data.location.lng, text: `AS${asnOpen}`, color: 'rgba(245,245,245,0.95)' };
    }
    if (!selected) return null;
    return { lat: selected.location.lat, lng: selected.location.lng, text: selected.location.city ?? selected.location.country, color: withAlpha(TYPE_META[selected.type].glow, 0.95) };
  }, [selected, asnOpen, profile.data]);

  const layers = useGlobeLayers(visible, {
    t,
    selectedId,
    hoveredId,
    you: who.data,
    affectedByYou,
    findCountry: geo.ready ? geo.findCountry : undefined,
    reducedMotion,
  });
  const asnLayers = useAsnLayers(asnOpen ? profile.data : null, ris, watchBgp, clock.now, reducedMotion);

  // Extra cable highlighted from the palette (real route geometry, no incident required).
  const extraPathRef = useRef<PathDatum | null>(null);
  const paths = useMemo(() => {
    if (!extraCableId) return layers.paths;
    const cable = CABLES.find((c) => c.id === extraCableId);
    if (!cable) return layers.paths;
    if (!extraPathRef.current || extraPathRef.current.id !== `cable:${cable.id}`) {
      extraPathRef.current = {
        id: `cable:${cable.id}`, incidentId: '', points: cable.landings.map((l) => [l.lat, l.lng] as [number, number]),
        color: [withAlpha('#fde68a', 0.9), withAlpha('#f59e0b', 0.9)], stroke: 1, dashLength: 0.03, dashGap: 0.015, dashAnimateTime: reducedMotion ? 0 : 9000,
        label: `<div class="tt-title">${cable.name}</div><div class="tt-meta">${cable.owners}, ${cable.lengthKm.toLocaleString()} km, ${cable.capacityTbps} Tbps, RFS ${cable.rfs}</div>`,
      };
    }
    return [...layers.paths, extraPathRef.current];
  }, [layers.paths, extraCableId, reducedMotion]);

  const points = useMemo(() => (asnLayers.points.length ? [...layers.points, ...asnLayers.points] : layers.points), [layers.points, asnLayers.points]);
  const arcs = useMemo(() => (asnLayers.arcs.length ? [...layers.arcs, ...asnLayers.arcs] : layers.arcs), [layers.arcs, asnLayers.arcs]);
  const rings = useMemo(() => (asnLayers.rings.length ? [...layers.rings, ...asnLayers.rings] : layers.rings), [layers.rings, asnLayers.rings]);

  // --- selection → fly-to ------------------------------------------------------
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setExtraCableId(null);
    if (!id) return;
    setAsnOpen(null);
    const inc = byId.get(id);
    if (!inc) return;
    if (inc.cable) {
      const c = centroid(inc.cable.landings);
      const span = haversineKm(inc.cable.landings[0], inc.cable.landings[inc.cable.landings.length - 1]);
      flyTo(c.lat, c.lng, altitudeForSpanKm(Math.max(span, 3000)));
    } else if (inc.path?.length && inc.type === 'ddos') {
      const pts = [inc.location, ...inc.path.map((p) => p.from)];
      const c = centroid(pts);
      const span = Math.max(...inc.path.map((p) => haversineKm(p.from, p.to)));
      flyTo(c.lat, c.lng, altitudeForSpanKm(Math.max(span, 2500)));
    } else {
      flyTo(inc.location.lat, inc.location.lng, undefined);
    }
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [byId, flyTo]);

  const openAsn = useCallback((asn: number) => {
    setAsnOpen(asn);
    setSelectedId(null);
    setExtraCableId(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const closeAsn = useCallback(() => {
    setAsnOpen(null);
    setWatchBgp(false);
    flownAsn.current = null;
  }, []);

  useEffect(() => {
    if (!asnOpen || !profile.data || profile.data.asn !== asnOpen || flownAsn.current === asnOpen) return;
    flownAsn.current = asnOpen;
    const loc = profile.data.location;
    if (!loc) return;
    const neighbours = profile.data.neighbours.top.filter((n) => n.location).slice(0, 10);
    const span = neighbours.length ? Math.max(...neighbours.map((n) => haversineKm(loc, n.location!))) : 0;
    flyTo(loc.lat, loc.lng, altitudeForSpanKm(Math.max(span, 2500)));
  }, [asnOpen, profile.data, flyTo]);

  // Selected incident from a permalink: fly once data + globe are ready.
  const flewToInitial = useRef(false);
  useEffect(() => {
    if (flewToInitial.current || !globeReady || !urlReady || !selectedId) return;
    if (!byId.get(selectedId)) return;
    flewToInitial.current = true;
    if (!initialPov) select(selectedId);
  }, [globeReady, urlReady, selectedId, byId, select, initialPov]);

  // --- URL sync ------------------------------------------------------------------
  const urlState: UrlState = useMemo(() => ({
    ...EMPTY_URL_STATE,
    incident: selectedId,
    types: types.size === INCIDENT_TYPES.length ? null : [...types],
    sev: severities.size === SEVERITIES.length ? null : [...severities],
    q: query,
    t: clock.isLive ? null : clock.viewTime,
    pov,
    asn: asnOpen,
  }), [selectedId, types, severities, query, clock.isLive, clock.viewTime, pov, asnOpen]);
  useUrlStateWriter(urlState, urlReady);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentShareUrl(urlState));
      setCopied(true);
      showToast('Link copied. It restores this camera, filters and selection.');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not access the clipboard.');
    }
  }, [urlState, showToast]);

  // --- "Am I affected?" -------------------------------------------------------------
  const handleYou = useCallback(async () => {
    if (who.data) {
      if (who.data.asn) openAsn(who.data.asn);
      else if (who.data.lat != null && who.data.lng != null) flyTo(who.data.lat, who.data.lng, 1.4);
      return;
    }
    const res = await who.lookup();
    if (!res) { showToast('Could not resolve your network. RIPEstat may be unreachable.'); return; }
    if (res.lat != null && res.lng != null) flyTo(res.lat, res.lng, 1.4);
    const n = inWindow.filter((i) => (res.asn && i.affectedASNs.some((a) => a.asn === res.asn)) || (res.countryCode && i.location.countryCode === res.countryCode && !i.aggregated)).length;
    showToast(n
      ? `${n} incident${n === 1 ? '' : 's'} in the last 24 hours touch ${res.asn ? `AS${res.asn}` : 'your country'}. Click again to explore your network.`
      : `No incidents touching ${res.asn ? `AS${res.asn}` : 'your network'} in the last 24 hours. Click again to explore it.`);
  }, [who, flyTo, inWindow, showToast, openAsn]);

  // --- export ------------------------------------------------------------------------
  const exportList = useCallback((format: 'csv' | 'json') => {
    const rows = list;
    if (format === 'csv') downloadText(exportFilename('csv'), toCsv(rows), 'text/csv;charset=utf-8');
    else downloadText(exportFilename('json'), JSON.stringify({ exportedAt: new Date().toISOString(), viewTime: new Date(t).toISOString(), count: rows.length, incidents: rows }, null, 2), 'application/json');
    showToast(`Exported ${rows.length} incident${rows.length === 1 ? '' : 's'} as ${format.toUpperCase()}.`);
  }, [list, t, showToast]);

  // --- filters -------------------------------------------------------------------------
  const toggleType = useCallback((type: IncidentType) => setTypes((prev) => {
    const next = new Set(prev);
    if (next.has(type)) { if (next.size > 1) next.delete(type); } else next.add(type);
    return next;
  }), []);
  const toggleSeverity = useCallback((sev: Severity) => setSeverities((prev) => {
    const next = new Set(prev);
    if (next.has(sev)) { if (next.size > 1) next.delete(sev); } else next.add(sev);
    return next;
  }), []);
  const resetFilters = useCallback(() => { setTypes(new Set(INCIDENT_TYPES)); setSeverities(new Set(SEVERITIES)); setQuery(''); }, []);
  const filterAsn = useCallback((asn: number) => { setQuery(`AS${asn}`); setShowResolved(true); setSidebarOpen(true); }, []);

  // --- command palette -------------------------------------------------------------------
  const paletteItems = useMemo(() => buildPaletteIndex(inWindow, {
    selectIncident: (id) => { setShowResolved(true); select(id); },
    flyTo: (lat, lng, alt) => flyTo(lat, lng, alt),
    showCable: (id) => {
      const cable = CABLES.find((c) => c.id === id);
      if (!cable) return;
      setSelectedId(null);
      setAsnOpen(null);
      setExtraCableId(id);
      const c = centroid(cable.landings);
      flyTo(c.lat, c.lng, altitudeForSpanKm(Math.max(haversineKm(cable.landings[0], cable.landings[cable.landings.length - 1]), 3000)));
      showToast(`${cable.name}: ${cable.owners}.`);
    },
    openAsn,
    searchText: (q) => { setQuery(q); setShowResolved(true); },
    goLive: clock.goLive,
    replay: () => { clock.setViewTime(Date.now() - DAY_MS); clock.setPlaying(true); },
    setOnlyType: (type) => setTypes(new Set(type ? [type] : INCIDENT_TYPES)),
    copyLink,
    whoAmI: handleYou,
    exportCsv: () => exportList('csv'),
  }), [inWindow, select, flyTo, clock, copyLink, handleYou, exportList, showToast, openAsn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (paletteOpen || typing) return;
      if (e.key === '/') { e.preventDefault(); setPaletteOpen(true); }
      else if (e.key === 'Escape') { if (asnOpen) closeAsn(); else if (selectedId) setSelectedId(null); else setExtraCableId(null); }
      else if (e.key === ' ') { e.preventDefault(); clock.togglePlaying(); }
      else if (e.key.toLowerCase() === 'l') clock.goLive();
      else if (e.key.toLowerCase() === 'f') setSidebarOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, selectedId, asnOpen, clock, closeAsn]);

  const onGlobeReady = useCallback(() => setGlobeReady(true), []);
  const onPovChange = useCallback((p: Pov) => setPov(p), []);
  const onGlobeSelect = useCallback((id: string | null) => {
    // Network markers carry the ASN as their id; incidents carry their incident id.
    if (id && /^\d+$/.test(id)) { openAsn(Number(id)); return; }
    select(id);
  }, [openAsn, select]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-paper text-fg">
      <main aria-label="Globe">
        <Globe
          points={points}
          rings={rings}
          arcs={arcs}
          paths={paths}
          polygons={layers.polygons}
          focus={focus}
          initialPov={initialPov}
          textureUrl={earthTexture}
          autoRotate={!selected && !hoveredId && !asnOpen && clock.isLive && !reducedMotion}
          label={globeLabel}
          onSelect={onGlobeSelect}
          onHover={setHoveredId}
          onReady={onGlobeReady}
          onPovChange={onPovChange}
        />
      </main>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.45)_100%)]" aria-hidden />

      <Header
        connection={feed.connection}
        lastUpdate={feed.lastUpdate}
        now={clock.now}
        sources={feed.sources}
        you={who.data}
        youLoading={who.loading}
        youError={who.error}
        affectedCount={affectedByYou.size}
        onYouClick={handleYou}
        onOpenPalette={() => setPaletteOpen(true)}
        onCopyLink={copyLink}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        copied={copied}
      />

      <Dashboard
        list={list}
        summary={summary}
        t={t}
        isLive={clock.isLive}
        types={types}
        severities={severities}
        coveredTypes={coveredTypes}
        sources={feed.sources}
        query={query}
        showResolved={showResolved}
        selectedId={selectedId}
        hoveredId={hoveredId}
        affectedByYou={affectedByYou}
        open={sidebarOpen}
        onToggleType={toggleType}
        onToggleSeverity={toggleSeverity}
        onResetFilters={resetFilters}
        onQuery={setQuery}
        onToggleResolved={() => setShowResolved((v) => !v)}
        onSelect={select}
        onHover={setHoveredId}
        onExport={exportList}
      />

      {asnOpen ? (
        <AsnExplorer
          asn={asnOpen}
          profile={profile}
          ris={ris}
          watching={watchBgp}
          incidentCount={asnIncidentCount}
          now={clock.now}
          onToggleWatch={() => setWatchBgp((w) => !w)}
          onClose={closeAsn}
          onFlyTo={() => { const l = profile.data?.location; if (l) flyTo(l.lat, l.lng, 1.6); }}
          onCopyLink={copyLink}
          onOpenAsn={openAsn}
          onFilterIncidents={() => filterAsn(asnOpen)}
        />
      ) : selected ? (
        <OutageDetail
          incident={selected}
          t={t}
          mine={affectedByYou.has(selected.id)}
          onClose={() => setSelectedId(null)}
          onFlyTo={() => select(selected.id)}
          onCopyLink={copyLink}
          onFilterAsn={filterAsn}
          onOpenAsn={openAsn}
        />
      ) : null}

      <Timeline incidents={inWindow} coveredTypes={coveredTypes} clock={clock} />

      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} onOpenAsn={openAsn} />

      {/* Keyboard hints: a right-aligned column beside the timeline, so it fits the gutter. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden flex-col items-end gap-1.5 font-mono text-[10px] text-fg-mute xl:flex" aria-hidden>
        <span className="inline-flex items-center gap-1">search <span className="kbd">Ctrl</span><span className="kbd">K</span></span>
        <span className="inline-flex items-center gap-1">play <span className="kbd">space</span></span>
        <span className="inline-flex items-center gap-1">live <span className="kbd">L</span></span>
        <span className="inline-flex items-center gap-1">close <span className="kbd">esc</span></span>
      </div>

      {toast && (
        <div role="status" className="bar pointer-events-none absolute left-1/2 top-[4.5rem] z-40 flex -translate-x-1/2 items-center gap-2 !rounded-full px-3.5 py-2 text-xs text-fg motion-safe:animate-fadeUp">
          <Icon name="check" className="h-3.5 w-3.5 text-emerald-300" /> {toast}
        </div>
      )}

      <BootOverlay ready={globeReady} incidentCount={incidents.length} countries={geo.countries} />
    </div>
  );
}

export type { Incident };
