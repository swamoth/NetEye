'use client';

import type { ConnectionState, SourceStatus, WhoAmI } from '@/app/utils/types';
import { formatRelative, formatUtcTime } from '@/app/utils/format';
import { TYPE_META } from '@/app/utils/theme';
import { Dot, Icon } from './ui';
import MetalSurface from './MetalSurface';

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
  connecting: { label: 'Connecting', color: '#787878', hint: 'Opening the WebSocket stream' },
  live: { label: 'Live', color: '#34d399', hint: 'Streaming updates over WebSocket' },
  polling: { label: 'Polling', color: '#fbbf24', hint: 'WebSocket unavailable. Refreshing over HTTP every 15 seconds.' },
  offline: { label: 'Offline', color: '#f08278', hint: 'The NetEye API is not reachable.' },
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
    <header className="bar pointer-events-auto absolute inset-x-3 top-3 z-30 flex h-[52px] items-center gap-3 px-2 md:inset-x-4 md:px-2.5">
      <button type="button" className="group press rounded-full md:hidden" aria-label="Toggle incident list" onClick={p.onToggleSidebar}>
        <MetalSurface size={32}>
          <Icon name="menu" className="h-[15px] w-[15px]" />
        </MetalSurface>
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden>
          <MetalSurface size={32} tone="bright">
            <Icon name="eye" className="h-[15px] w-[15px]" />
          </MetalSurface>
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-medium tracking-[-0.01em] text-fg">NetEye</div>
          <div className="hidden truncate font-mono text-[10.5px] text-fg-mute lg:block">global internet health, last 24 h</div>
        </div>
      </div>

      <div className="hidden h-5 w-px bg-line md:block" aria-hidden />

      <div className="hidden items-center gap-2 md:flex" title={c.hint}>
        <Dot color={c.color} className={p.connection === 'live' ? 'motion-safe:animate-livePulse' : ''} />
        <span className="text-xs font-medium text-fg">{c.label}</span>
        <span className="font-mono text-[10.5px] text-fg-mute">{p.lastUpdate ? `updated ${formatRelative(p.lastUpdate, p.now)}` : 'waiting for data'}</span>
      </div>

      <div className="hidden h-5 w-px bg-line lg:block" aria-hidden />

      <div className="hidden min-w-0 items-center gap-2 lg:flex" title={sourceTitle}>
        <Icon name="signal" className={`h-3.5 w-3.5 shrink-0 ${healthy ? 'text-emerald-300' : live.length ? 'text-amber-300' : 'text-fg-mute'}`} />
        {live.length ? (
          <span className="truncate text-[11px]">
            <span className="font-medium text-fg-soft">{live.map((s) => s.name).join(', ')}</span>
            <span className="font-mono text-[10.5px] text-fg-mute"> · {covered.map((t) => TYPE_META[t].label.toLowerCase()).join(', ')}</span>
          </span>
        ) : (
          <span className="truncate text-[11px] text-amber-200">No live data source configured</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className={`btn ${p.you ? 'text-fg' : ''}`}
          onClick={p.onYouClick}
          title={p.you ? 'Fly to your network' : 'Look up your ISP and ASN with RIPEstat and highlight incidents that touch it'}
          aria-busy={p.youLoading}
        >
          {p.you ? <Dot color="#34d399" /> : <Icon name="user" className="h-3.5 w-3.5" />}
          {p.you ? (
            <span className="max-w-[220px] truncate">
              You · <span className="font-mono">{p.you.asn ? `AS${p.you.asn}` : 'unknown ASN'}</span>
              {p.affectedCount > 0 && (
                <span className="tnum ml-1.5 rounded-full bg-[#f08278]/15 px-1.5 py-0.5 font-mono text-[10.5px] text-[#f5b8b0]">
                  {p.affectedCount} hit{p.affectedCount === 1 ? '' : 's'}
                </span>
              )}
            </span>
          ) : p.youLoading ? (
            <span>Resolving</span>
          ) : p.youError ? (
            <span className="text-amber-200">Lookup failed, retry</span>
          ) : (
            <span className="hidden sm:inline">Am I affected?</span>
          )}
        </button>

        <button type="button" className="btn hidden md:inline-flex" onClick={p.onOpenPalette} title="Search incidents, networks, places and cables">
          <Icon name="search" className="h-3.5 w-3.5" />
          <span>Search</span>
          <span className="ml-0.5 inline-flex gap-1">
            <span className="kbd">Ctrl</span>
            <span className="kbd">K</span>
          </span>
        </button>

        <button type="button" className="btn" onClick={p.onCopyLink} title="Copy a link to this exact view" aria-live="polite">
          <Icon name={p.copied ? 'check' : 'link'} className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{p.copied ? 'Copied' : 'Share'}</span>
        </button>

        <div className="tnum hidden items-center gap-1.5 pl-2 font-mono text-[11px] text-fg-mute sm:flex" title="Coordinated Universal Time">
          <time dateTime={new Date(p.now).toISOString()}>{formatUtcTime(p.now, false)} UTC</time>
        </div>
      </div>
    </header>
  );
}
