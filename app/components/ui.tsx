'use client';

import type { ReactNode } from 'react';
import {
  ArrowRight, ArrowSquareOut, ArrowUUpLeft, Broadcast, CaretRight, Check, Clock, Command, DownloadSimple, Eye, Funnel, Globe, Info,
  Link, List, MagnifyingGlass, Pause, Play, Pulse, ShareNetwork, ShieldCheck, ShieldWarning, User, Warning, X, Graph, Rewind,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import type { IncidentStatus, IncidentType, Severity } from '@/app/utils/types';
import { SEVERITY_META, STATUS_META, TYPE_META, withAlpha } from '@/app/utils/theme';

/* ---------------------------------------------------------------------------
 * Icons: one family (Phosphor), one weight.
 * ------------------------------------------------------------------------- */

const ICONS = {
  eye: Eye, search: MagnifyingGlass, close: X, play: Play, pause: Pause, live: Broadcast, link: Link, download: DownloadSimple,
  external: ArrowSquareOut, user: User, signal: Pulse, chevron: CaretRight, filter: Funnel, clock: Clock, globe: Globe,
  command: Command, menu: List, 'arrow-right': ArrowRight, check: Check, warning: Warning, info: Info, network: ShareNetwork,
  'shield-check': ShieldCheck, 'shield-warning': ShieldWarning, graph: Graph, rewind: Rewind, back: ArrowUUpLeft,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'h-4 w-4', label }: { name: IconName; className?: string; label?: string }) {
  const Cmp = ICONS[name];
  return <Cmp className={className} weight="regular" aria-hidden={label ? undefined : true} aria-label={label} />;
}

/* ---------------------------------------------------------------------------
 * Marks + badges. Identity is carried by the coloured mark; text stays neutral.
 * ------------------------------------------------------------------------- */

export function Dot({ color, className = '' }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

export function TypeBadge({ type, className = '' }: { type: IncidentType; className?: string }) {
  const m = TYPE_META[type];
  return (
    <span className={`chip ${className}`}>
      <Dot color={m.color} />
      {m.label}
    </span>
  );
}

export function SeverityBadge({ severity, className = '' }: { severity: Severity; className?: string }) {
  const m = SEVERITY_META[severity];
  return (
    <span className={`chip ${className}`} title={`${m.label} severity`}>
      <span aria-hidden className="inline-flex items-end gap-px">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-[3px] rounded-[1px]" style={{ height: 4 + i * 2, background: i <= m.rank ? m.color : withAlpha(m.color, 0.2) }} />
        ))}
      </span>
      {m.label}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: IncidentStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={`chip ${className}`}>
      <Dot color={m.color} className={status === 'active' ? 'motion-safe:animate-livePulse' : ''} />
      {m.label}
    </span>
  );
}

export function SourceBadge({ name, link, className = '' }: { name: string; link?: string; className?: string }) {
  const inner = (
    <>
      <Icon name="signal" className="h-3 w-3 text-emerald-300" />
      {name}
    </>
  );
  return link ? (
    <a className={`chip hover:border-line-strong hover:text-fg ${className}`} href={link} target="_blank" rel="noreferrer" title={`Live data from ${name}. Opens the source.`}>
      {inner}
    </a>
  ) : (
    <span className={`chip ${className}`} title={`Live data from ${name}`}>{inner}</span>
  );
}

/* ---------------------------------------------------------------------------
 * Layout helpers
 * ------------------------------------------------------------------------- */

/** Section heading: small tracked mono label, optional right-hand meta. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="mono-label">{children}</h3>
      {right && <span className="font-mono text-[10px] text-fg-mute">{right}</span>}
    </div>
  );
}

/**
 * Stat tile (dataviz contract): mono label, proportional semibold value in the body sans,
 * optional mono sub-line. No estimates live here; every value is a count from the feed.
 */
export function Stat({ label, value, sub, title }: { label: string; value: ReactNode; sub?: ReactNode; title?: string }) {
  return (
    <div className="tile px-3 py-2.5" title={title}>
      <div className="font-mono text-[10.5px] text-fg-mute">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">{value}</div>
      {sub && <div className="mt-1.5 font-mono text-[10.5px] leading-snug text-fg-mute">{sub}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`motion-safe:animate-pulse rounded-tile bg-white/[0.05] ${className}`} />;
}

export function EmptyState({ icon = 'info', title, body, action }: { icon?: IconName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-tile border border-line text-fg-soft">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="text-sm font-medium text-fg">{title}</div>
      {body && <div className="mt-1 max-w-[30ch] text-xs leading-relaxed text-fg-mute">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
