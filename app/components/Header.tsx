'use client';

import type { ConnectionState, SourceStatus, WhoAmI } from '@/app/utils/types';
import { formatRelative, formatUtcTime } from '@/app/utils/format';
import { TYPE_META } from '@/app/utils/theme';
import { Dot, Icon } from './ui';

interface HeaderProps {
  connection: ConnectionState;
  lastUpdate: number | null;
  now: number;
  sources: SourceStatus[];
  you: WhoAmI | null;
  youLoading: boolean;
  youError: string | null;
  affectedCount: number;
  onYouClick: () => void;
  onOpenPalette: () => void;
  onCopyLink: () => void;
  onToggleSidebar: () => void;
  copied: boolean;
}

const CONNECTION_META: Record<ConnectionState, { label: string; color: string; hint: string }> = {
  connecting: { label: 'Connecting', color: '#94a3b8', hint: 'Opening the WebSocket stream' },
  live: { label: 'Live', color: '#34d399', hint: 'Streaming updates over WebSocket' },
  polling: { label: 'Polling', color: '#fbbf24', hint: 'WebSocket unavailable. Refreshing over HTTP every 15 seconds.' },
  offline: { label: 'Offline', color: '#f87171', hint: 'The NetEye API is not reachable.' },
};

export default function Header(p: HeaderProps) {
  const c = CONNECTION_META[p.connection];
  const live = p.sources.filter((s) => s.mode === 'live');
  const healthy = live.length > 0 && live.every((s) => s.status === 'ok');
  const covered = [...new Set(live.flatMap((s) => s.coveredTypes))];
  const sourceTitle = p.sources
    .map((s) => `${s.name}: ${s.mode === 'disabled' ? 'disabled (no API token)' : s.status}. ${s.count} incidents. Types: ${s.types.join(', ')}.${s.error ? ` ${s.error}` : ''}`)
    .join('\n');

  return (
    <header className="glass pointer-events-auto absolute inset-x-3 top-3 z-30 flex h-12 items-center gap-3 px-2 md:inset-x-4 md:px-3">
      <button type="button" className="btn-ghost !px-2 md:hidden" aria-label="Toggle incident list" onClick={p.onToggleSidebar}>
        <Icon name="menu" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-block bg-accent/15 text-accent" aria-hidden>
          <Icon name="eye" className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight text-slate-50">NetEye</div>
          <div className="hidden truncate text-[11px] text-slate-400 lg:block">Global internet health, last 24 hours</div>
        </div>
      </div>

      <div className="hidden h-6 w-px bg-slate-700/60 md:block" aria-hidden />

      <div className="hidden items-center gap-2 md:flex" title={c.hint}>
        <Dot color={c.color} className={p.connection === 'live' ? 'motion-safe:animate-livePulse' : ''} />
        <span className="text-xs font-medium text-slate-100">{c.label}</span>
        <span className="text-[11px] text-slate-400">{p.lastUpdate ? `updated ${formatRelative(p.lastUpdate, p.now)}` : 'waiting for data'}</span>
      </div>

      <div className="hidden h-6 w-px bg-slate-700/60 lg:block" aria-hidden />

      <div className="hidden min-w-0 items-center gap-2 lg:flex" title={sourceTitle}>
        <Icon name="signal" className={`h-3.5 w-3.5 shrink-0 ${healthy ? 'text-emerald-300' : live.length ? 'text-amber-300' : 'text-slate-400'}`} />
        {live.length ? (
          <span className="truncate text-[11px] text-slate-300">
            <span className="font-medium text-slate-100">{live.map((s) => s.name).join(', ')}</span>
            <span className="text-slate-400"> · {covered.map((t) => TYPE_META[t].label.toLowerCase()).join(', ')}</span>
          </span>
        ) : (
          <span className="truncate text-[11px] text-amber-200">No live data source configured</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className={`btn-ghost ${p.you ? 'border-emerald-500/40 text-emerald-200' : ''}`}
          onClick={p.onYouClick}
          title={p.you ? 'Fly to your network' : 'Look up your ISP and ASN with RIPEstat and highlight incidents that touch it'}
          aria-busy={p.youLoading}
        >
          <Icon name="user" className="h-3.5 w-3.5" />
          {p.you ? (
            <span className="max-w-[220px] truncate">
              You · {p.you.asn ? `AS${p.you.asn}` : 'unknown ASN'}
              {p.affectedCount > 0 && <span className="tnum ml-1.5 rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">{p.affectedCount} hit{p.affectedCount === 1 ? '' : 's'}</span>}
            </span>
          ) : p.youLoading ? (
            <span>Resolving</span>
          ) : p.youError ? (
            <span className="text-amber-200">Lookup failed, retry</span>
          ) : (
            <span className="hidden sm:inline">Am I affected?</span>
          )}
        </button>

        <button type="button" className="btn-ghost hidden md:inline-flex" onClick={p.onOpenPalette} title="Search incidents, networks, places and cables">
          <Icon name="search" className="h-3.5 w-3.5" />
          <span>Search</span>
          <span className="kbd">Ctrl</span>
          <span className="kbd">K</span>
        </button>

        <button type="button" className="btn-ghost" onClick={p.onCopyLink} title="Copy a link to this exact view" aria-live="polite">
          <Icon name={p.copied ? 'check' : 'link'} className={`h-3.5 w-3.5 ${p.copied ? 'text-emerald-300' : ''}`} />
          <span className="hidden sm:inline">{p.copied ? 'Copied' : 'Share'}</span>
        </button>

        <div className="tnum hidden items-center gap-1.5 pl-1 text-[11px] text-slate-300 sm:flex" title="Coordinated Universal Time">
          <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
          <time dateTime={new Date(p.now).toISOString()}>{formatUtcTime(p.now, false)} UTC</time>
        </div>
      </div>
    </header>
  );
}
