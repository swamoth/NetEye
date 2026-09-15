'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { Incident, IncidentType, Severity, SourceStatus } from '@/app/utils/types';
import { INCIDENT_TYPES, SEVERITIES } from '@/app/utils/types';
import { SEVERITY_META, STATUS_META, TYPE_META, withAlpha } from '@/app/utils/theme';
import { statusAt, type KpiSummary } from '@/app/utils/incidents';
import { formatRelative } from '@/app/utils/format';
import { Dot, EmptyState, Icon, Stat } from './ui';

export interface DashboardProps {
  list: Incident[];
  summary: KpiSummary;
  t: number;
  isLive: boolean;
  types: Set<IncidentType>;
  severities: Set<Severity>;
  coveredTypes: Set<IncidentType>;
  sources: SourceStatus[];
  query: string;
  showResolved: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  affectedByYou: Set<string>;
  open: boolean;
  onToggleType: (t: IncidentType) => void;
  onToggleSeverity: (s: Severity) => void;
  onResetFilters: () => void;
  onQuery: (q: string) => void;
  onToggleResolved: () => void;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onExport: (format: 'csv' | 'json') => void;
}

export default function Dashboard(p: DashboardProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const filtersActive = p.types.size !== INCIDENT_TYPES.length || p.severities.size !== SEVERITIES.length || p.query.trim() !== '';
  const s = p.summary;
  const noSource = !p.sources.some((src) => src.mode === 'live');
  const sourceError = p.sources.find((src) => src.mode === 'live' && src.status !== 'ok');

  return (
    <aside
      id="incident-list"
      className={`glass pointer-events-auto absolute bottom-[7.5rem] left-3 top-[4.25rem] z-20 flex w-[min(340px,calc(100vw-1.5rem))] flex-col overflow-hidden transition-transform duration-200 md:left-4 md:translate-x-0 ${p.open ? 'translate-x-0' : '-translate-x-[120%]'}`}
      aria-label="Incident dashboard"
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 p-3 pb-2">
        <Stat label="Active incidents" value={s.active + s.mitigating} sub={`${s.mitigating} mitigating, ${s.resolved} resolved in 24h`} />
        <Stat label="High and critical" value={s.high + s.critical} sub={`${s.critical} critical`} />
        <Stat label="Countries affected" value={s.countries} sub="with an active incident" />
        <Stat label="Networks named" value={s.asns} sub="distinct ASNs in active incidents" />
      </div>

      {/* Filters */}
      <div className="px-3 pb-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Incident types</span>
          {filtersActive && <button type="button" className="text-[11px] text-accent hover:underline" onClick={p.onResetFilters}>Reset filters</button>}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by incident type">
          {INCIDENT_TYPES.map((type) => {
            const m = TYPE_META[type];
            const covered = p.coveredTypes.has(type);
            const on = covered && p.types.has(type);
            return (
              <button
                key={type}
                type="button"
                className={`chip ${on ? 'border-slate-500/70 bg-ink-600/70' : 'border-slate-700/60 bg-transparent text-slate-400'} disabled:cursor-not-allowed disabled:opacity-50`}
                aria-pressed={on}
                disabled={!covered}
                onClick={() => p.onToggleType(type)}
                title={covered ? m.description : `${m.label}: no live data source yet`}
              >
                <Dot color={on ? m.color : withAlpha(m.color, 0.35)} />
                {m.label}
                {covered ? <span className="tnum text-slate-400">{s.activeByType[type]}</span> : <span className="text-[10px] text-slate-500">no feed</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
          {SEVERITIES.map((sev) => {
            const on = p.severities.has(sev);
            const m = SEVERITY_META[sev];
            return (
              <button
                key={sev}
                type="button"
                className={`chip ${on ? 'border-slate-500/70 bg-ink-600/70' : 'border-slate-700/60 bg-transparent text-slate-400'}`}
                aria-pressed={on}
                onClick={() => p.onToggleSeverity(sev)}
              >
                <Dot color={on ? m.color : withAlpha(m.color, 0.35)} />
                {m.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`chip ml-auto ${p.showResolved ? 'border-slate-500/70 bg-ink-600/70' : 'border-slate-700/60 bg-transparent text-slate-400'}`}
            aria-pressed={p.showResolved}
            onClick={p.onToggleResolved}
            title="Include resolved incidents in the list"
          >
            <Dot color={p.showResolved ? STATUS_META.resolved.color : withAlpha(STATUS_META.resolved.color, 0.35)} />
            Show resolved
          </button>
        </div>
        <label className="relative mt-2 block">
          <span className="sr-only">Filter incidents</span>
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Filter by city, country, ASN or cable"
            className="field pl-8 pr-8"
          />
          {p.query && (
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-100" onClick={() => p.onQuery('')} aria-label="Clear filter">
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between border-t border-slate-700/40 px-3 py-2">
        <h2 className="text-xs font-semibold text-slate-300">
          <span className="tnum">{p.list.length}</span> incident{p.list.length === 1 ? '' : 's'}
          {!p.isLive && <span className="ml-1.5 font-normal text-accent">at replay time</span>}
        </h2>
        <div className="relative">
          <button type="button" className="btn-ghost !py-1" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen} aria-haspopup="menu" title="Export the current list">
            <Icon name="download" className="h-3.5 w-3.5" /> Export
          </button>
          {exportOpen && (
            <div role="menu" className="glass absolute right-0 top-8 z-10 flex w-44 flex-col p-1 text-xs" onMouseLeave={() => setExportOpen(false)}>
              <button type="button" role="menuitem" className="rounded-block px-2 py-1.5 text-left hover:bg-slate-700/50" onClick={() => { p.onExport('csv'); setExportOpen(false); }}>CSV of this list</button>
              <button type="button" role="menuitem" className="rounded-block px-2 py-1.5 text-left hover:bg-slate-700/50" onClick={() => { p.onExport('json'); setExportOpen(false); }}>JSON of this list</button>
              <a role="menuitem" className="rounded-block px-2 py-1.5 text-left hover:bg-slate-700/50" href="/api/feed" target="_blank" rel="noreferrer">RSS feed</a>
              <a role="menuitem" className="rounded-block px-2 py-1.5 text-left hover:bg-slate-700/50" href="/api/outages" target="_blank" rel="noreferrer">REST API</a>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
        {noSource ? (
          <EmptyState
            icon="warning"
            title="No live data source configured"
            body={<>NetEye shows real incidents only. Add <code className="font-mono text-slate-300">CLOUDFLARE_API_TOKEN</code> to <code className="font-mono text-slate-300">.env.local</code> and restart the servers.</>}
            action={<a className="btn-ghost" href="https://github.com/swamoth/NetEye#getting-a-cloudflare-radar-token-free" target="_blank" rel="noreferrer">How to get a token <Icon name="external" className="h-3 w-3" /></a>}
          />
        ) : p.list.length === 0 ? (
          filtersActive ? (
            <EmptyState icon="filter" title="No incidents match these filters" action={<button type="button" className="btn-ghost" onClick={p.onResetFilters}>Reset filters</button>} />
          ) : (
            <EmptyState
              icon={sourceError ? 'warning' : 'check'}
              title={sourceError ? `${sourceError.name} is ${sourceError.status}` : p.isLive ? 'No incidents in the last 24 hours' : 'Nothing active at this point in time'}
              body={sourceError?.error ?? (p.isLive ? 'The feeds are healthy. Quiet day.' : 'Drag the timeline or return to live.')}
            />
          )
        ) : (
          <ul className="m-0 list-none p-0">
            {p.list.map((inc) => (
              <IncidentRow
                key={inc.id}
                inc={inc}
                t={p.t}
                selected={inc.id === p.selectedId}
                hovered={inc.id === p.hoveredId}
                mine={p.affectedByYou.has(inc.id)}
                onSelect={p.onSelect}
                onHover={p.onHover}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface RowProps {
  inc: Incident;
  t: number;
  selected: boolean;
  hovered: boolean;
  mine: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

const IncidentRow = memo(function IncidentRow({ inc, t, selected, hovered, mine, onSelect, onHover }: RowProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const status = statusAt(inc, t) ?? inc.status;
  const m = TYPE_META[inc.type];
  const sev = SEVERITY_META[inc.severity];
  const where = [inc.location.city, inc.location.country].filter(Boolean).join(', ');

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <li>
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(selected ? null : inc.id)}
        onMouseEnter={() => onHover(inc.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(inc.id)}
        onBlur={() => onHover(null)}
        aria-pressed={selected}
        className={`group mb-1 flex w-full gap-2.5 rounded-block border px-2.5 py-2 text-left transition-[background-color,border-color] duration-150 ${
          selected ? 'border-accent/50 bg-accent/10' : hovered ? 'border-slate-600/70 bg-slate-800/60' : 'border-transparent hover:border-slate-700/70 hover:bg-slate-800/40'
        } ${status === 'resolved' ? 'opacity-60' : ''}`}
      >
        <span aria-hidden className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full" style={{ background: m.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>{m.short}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-flex items-end gap-px">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="w-[2px] rounded-[1px]" style={{ height: 3 + i * 2, background: i <= sev.rank ? sev.color : withAlpha(sev.color, 0.2) }} />
                ))}
              </span>
              {sev.label}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {mine && <span className="rounded bg-emerald-500/15 px-1 text-emerald-200" title="Touches your network">you</span>}
              <time dateTime={inc.startedAt}>{formatRelative(inc.startedAt, t)}</time>
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs font-medium text-slate-100" title={inc.title}>{inc.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Dot color={STATUS_META[status].color} className="h-1.5 w-1.5" />
            <span className="sr-only">{STATUS_META[status].label},</span>
            <span className="truncate">{where}</span>
            {inc.affectedASNs[0] && <span className="tnum ml-auto shrink-0 text-slate-400">AS{inc.affectedASNs[0].asn}</span>}
          </span>
        </span>
      </button>
    </li>
  );
});
