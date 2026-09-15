'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Incident } from '@/app/utils/types';
import { TYPE_META } from '@/app/utils/theme';
import { CITIES } from '@/server/data/cities';
import { CABLES } from '@/server/data/cables';
import { ASNS } from '@/server/data/asns';
import { COUNTRIES } from '@/server/data/countries';
import { Icon, type IconName } from './ui';

export type PaletteKind = 'incident' | 'city' | 'country' | 'cable' | 'asn' | 'action';

export interface PaletteItem {
  id: string;
  kind: PaletteKind;
  title: string;
  subtitle?: string;
  keywords: string;
  color?: string;
  icon?: IconName;
  run: () => void;
}

export interface PaletteActions {
  selectIncident: (id: string) => void;
  flyTo: (lat: number, lng: number, altitude?: number) => void;
  showCable: (id: string) => void;
  openAsn: (asn: number) => void;
  searchText: (q: string) => void;
  goLive: () => void;
  replay: () => void;
  setOnlyType: (type: Incident['type'] | null) => void;
  copyLink: () => void;
  whoAmI: () => void;
  exportCsv: () => void;
}

const KIND_LABEL: Record<PaletteKind, string> = { incident: 'Incidents', city: 'Cities', country: 'Countries', cable: 'Submarine cables', asn: 'Networks', action: 'Actions' };
const KIND_ORDER: PaletteKind[] = ['action', 'incident', 'city', 'country', 'cable', 'asn'];

function score(item: PaletteItem, words: string[]): number {
  const title = item.title.toLowerCase();
  const kw = item.keywords.toLowerCase();
  let total = 0;
  for (const w of words) {
    if (title.startsWith(w)) total += 4;
    else if (title.includes(w)) total += 3;
    else if (kw.includes(w)) total += 1;
    else return 0;
  }
  return total;
}

export function buildPaletteIndex(incidents: Incident[], a: PaletteActions): PaletteItem[] {
  const items: PaletteItem[] = [];

  items.push(
    { id: 'act:live', kind: 'action', title: 'Go live', subtitle: 'Return to the present', keywords: 'live now realtime reset time', icon: 'live', run: a.goLive },
    { id: 'act:replay', kind: 'action', title: 'Replay the last 24 hours', subtitle: 'Play the timeline from 24 hours ago', keywords: 'replay play history rewind timeline', icon: 'play', run: a.replay },
    { id: 'act:you', kind: 'action', title: 'Am I affected?', subtitle: 'Detect my ISP and highlight incidents touching it', keywords: 'me my network isp asn location affected', icon: 'user', run: a.whoAmI },
    { id: 'act:link', kind: 'action', title: 'Copy link to this view', subtitle: 'Share the current camera, filters and selection', keywords: 'share copy url permalink link', icon: 'link', run: a.copyLink },
    { id: 'act:csv', kind: 'action', title: 'Export filtered incidents as CSV', keywords: 'export download csv data', icon: 'download', run: a.exportCsv },
    { id: 'act:all', kind: 'action', title: 'Show all incident types', keywords: 'filter reset all types clear', icon: 'filter', run: () => a.setOnlyType(null) },
  );
  for (const [type, m] of Object.entries(TYPE_META) as [Incident['type'], (typeof TYPE_META)[Incident['type']]][]) {
    items.push({ id: `act:only:${type}`, kind: 'action', title: `Only ${m.label.toLowerCase()}s`, subtitle: m.description, keywords: `filter only ${type} ${m.label}`, color: m.color, icon: 'filter', run: () => a.setOnlyType(type) });
  }

  for (const inc of incidents) {
    if (inc.aggregated) continue;
    items.push({
      id: `inc:${inc.id}`,
      kind: 'incident',
      title: inc.title,
      subtitle: `${[inc.location.city, inc.location.country].filter(Boolean).join(', ')} · ${TYPE_META[inc.type].label} · ${inc.severity}`,
      keywords: `${inc.location.city ?? ''} ${inc.location.country} ${inc.location.countryCode} ${inc.type} ${inc.severity} ${inc.cause ?? ''} ${inc.affectedASNs.map((x) => `as${x.asn} ${x.name}`).join(' ')} ${inc.cable?.name ?? ''}`,
      color: TYPE_META[inc.type].color,
      run: () => a.selectIncident(inc.id),
    });
  }

  for (const c of CITIES) {
    items.push({ id: `city:${c.name}`, kind: 'city', title: c.name, subtitle: `${c.country} · ${c.region}`, keywords: `${c.country} ${c.cc} ${c.region}`, icon: 'globe', run: () => a.flyTo(c.lat, c.lng, 1.2) });
  }
  for (const [cc, k] of Object.entries(COUNTRIES)) {
    items.push({ id: `cc:${cc}`, kind: 'country', title: k.name, subtitle: cc, keywords: cc, icon: 'globe', run: () => { a.flyTo(k.lat, k.lng, 1.6); a.searchText(k.name); } });
  }
  for (const cable of CABLES) {
    items.push({ id: `cable:${cable.id}`, kind: 'cable', title: cable.name, subtitle: `${cable.landings[0].name} → ${cable.landings[cable.landings.length - 1].name} · ${cable.capacityTbps} Tbps`, keywords: `${cable.owners} ${cable.landings.map((l) => l.name).join(' ')} submarine cable`, color: TYPE_META.cable_cut.color, run: () => a.showCable(cable.id) });
  }
  for (const asn of ASNS) {
    items.push({ id: `asn:${asn.asn}`, kind: 'asn', title: `AS${asn.asn} ${asn.name}`, subtitle: `${asn.city}, ${asn.cc}. Open in the ASN explorer`, keywords: `${asn.name} ${asn.city} ${asn.cc} as${asn.asn} ${asn.asn}`, icon: 'network', run: () => a.openAsn(asn.asn) });
  }
  return items;
}

export interface CommandPaletteProps {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
  /** Lets "AS13335" or "13335" open any network, not just the curated list. */
  onOpenAsn?: (asn: number) => void;
}

export default function CommandPalette({ open, items, onClose, onOpenAsn }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let scored: { item: PaletteItem; s: number }[];
    if (!words.length) {
      scored = items.filter((i) => i.kind === 'action' || i.kind === 'incident').slice(0, 14).map((item, i) => ({ item, s: 100 - i }));
    } else {
      scored = items.map((item) => ({ item, s: score(item, words) })).filter((x) => x.s > 0);
      scored.sort((a, b) => b.s - a.s || KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind));
      scored = scored.slice(0, 40);
      const m = /^(?:as)?(\d{1,10})$/i.exec(q.trim());
      if (m && onOpenAsn) {
        const n = Number(m[1]);
        if (!scored.some((x) => x.item.id === `asn:${n}`)) {
          scored.unshift({ item: { id: `dyn:asn:${n}`, kind: 'asn', title: `AS${n}`, subtitle: 'Open in the ASN explorer (RIPEstat, Cloudflare Radar, RIS Live)', keywords: '', icon: 'network', run: () => onOpenAsn(n) }, s: 1000 });
        }
      }
    }
    // group by kind preserving score order within groups
    const groups = new Map<PaletteKind, PaletteItem[]>();
    for (const { item } of scored) {
      if (!groups.has(item.kind)) groups.set(item.kind, []);
      groups.get(item.kind)!.push(item);
    }
    const flat: PaletteItem[] = [];
    for (const k of KIND_ORDER) for (const it of groups.get(k) ?? []) flat.push(it);
    return { groups, flat };
  }, [items, q, onOpenAsn]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const run = (item: PaletteItem) => {
    item.run();
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.flat.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = results.flat[cursor]; if (it) run(it); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let index = -1;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="glass w-full max-w-xl overflow-hidden motion-safe:animate-fadeUp" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-700/50 px-3 py-2.5">
          <Icon name="search" className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search incidents, networks (AS13335), cities, countries, cables, or an action"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5">
          {results.flat.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-400">Nothing matches &ldquo;{q}&rdquo;.</div>}
          {KIND_ORDER.map((kind) => {
            const group = results.groups.get(kind);
            if (!group?.length) return null;
            return (
              <div key={kind} className="mb-1">
                <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">{KIND_LABEL[kind]}</div>
                {group.map((item) => {
                  index += 1;
                  const active = index === cursor;
                  const i = index;
                  return (
                    <button
                      key={item.id}
                      data-index={i}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => run(item)}
                      className={`flex w-full items-center gap-2.5 rounded-block px-2 py-1.5 text-left ${active ? 'bg-accent/15' : 'hover:bg-slate-800/60'}`}
                    >
                      {item.color ? (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                      ) : (
                        <Icon name={item.icon ?? 'globe'} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-slate-100">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-[11px] text-slate-400">{item.subtitle}</span>}
                      </span>
                      {active && <span className="kbd">↵</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-700/50 px-3 py-1.5 text-[10px] text-slate-400">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
          <span><span className="kbd">↵</span> select</span>
          <span className="ml-auto">{results.flat.length} result{results.flat.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
