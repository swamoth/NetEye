'use client';

import type { Incident } from '@/app/utils/types';
import { NEUTRAL, ROLE_LABEL, SEVERITY_META, STATUS_META, TYPE_META, withAlpha } from '@/app/utils/theme';
import { statusAt } from '@/app/utils/incidents';
import { formatDuration, formatKm, formatNumber, formatPct, formatRelative, formatUtcDateTime, titleCase } from '@/app/utils/format';
import { formatLatLng } from '@/app/utils/coordinates';
import { Dot, Icon, SectionTitle, SeverityBadge, SourceBadge, StatusBadge, TypeBadge } from './ui';
import MetalSurface from './MetalSurface';

export interface OutageDetailProps {
  incident: Incident;
  t: number;
  mine: boolean;
  onClose: () => void;
  onFlyTo: () => void;
  onCopyLink: () => void;
  onFilterAsn: (asn: number) => void;
  onOpenAsn: (asn: number) => void;
}

export default function OutageDetail({ incident: inc, t, mine, onClose, onFlyTo, onCopyLink, onFilterAsn, onOpenAsn }: OutageDetailProps) {
  const status = statusAt(inc, t) ?? inc.status;
  const m = TYPE_META[inc.type];
  const events = inc.timeline.filter((e) => Date.parse(e.at) <= t);
  const endAt = status === 'resolved' && inc.resolvedAt ? Date.parse(inc.resolvedAt) : t;
  const facts: { label: string; value: string }[] = [];
  if (inc.metrics.prefixes != null) facts.push({ label: 'Prefixes involved', value: formatNumber(inc.metrics.prefixes) });
  if (inc.metrics.confidence != null) facts.push({ label: 'Detector score', value: `${inc.metrics.confidence} of 12` });
  if (inc.metrics.peers != null) facts.push({ label: 'RIS peers observing', value: formatNumber(inc.metrics.peers) });
  if (inc.metrics.events != null && inc.metrics.events > 1) facts.push({ label: 'Detections in 24h', value: formatNumber(inc.metrics.events) });
  if (inc.metrics.sharePct != null) facts.push({ label: 'Share of global L3 DDoS bytes', value: formatPct(inc.metrics.sharePct, 1) });
  if (inc.cause) facts.push({ label: 'Cause', value: titleCase(inc.cause) });
  facts.push({ label: 'Source confidence', value: formatPct(inc.confidence * 100) });

  return (
    <aside className="bar pointer-events-auto absolute bottom-[7.5rem] right-3 top-[4.25rem] z-20 flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-clip motion-safe:animate-fadeUp md:right-4" aria-label="Incident details">
      <div className="h-[2px] w-full" style={{ background: m.color }} aria-hidden />
      <div className="flex items-start gap-2 p-3 pb-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <TypeBadge type={inc.type} />
          <SeverityBadge severity={inc.severity} />
          <StatusBadge status={status} />
          <SourceBadge name={inc.sourceName} link={inc.link} />
          {inc.aggregated && <span className="chip" title="A rolling 24-hour statistic, not a single event">Aggregate</span>}
          {mine && <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-200">Touches your network</span>}
        </div>
        <button type="button" className="group press -mr-0.5 -mt-0.5 rounded-full" onClick={onClose} aria-label="Close details">
          <MetalSurface size={32}><Icon name="close" className="h-[15px] w-[15px]" /></MetalSurface>
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
        <h2 className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-fg">{inc.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] text-fg-mute">
          <span className="text-fg-soft">{[inc.location.city, inc.location.country].filter(Boolean).join(', ')}</span>
          <span>{inc.location.region}</span>
          <span className="tnum">{formatLatLng(inc.location)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="btn" onClick={onFlyTo}><Icon name="globe" className="h-3.5 w-3.5" /> Fly to</button>
          <button type="button" className="btn" onClick={onCopyLink}><Icon name="link" className="h-3.5 w-3.5" /> Copy link</button>
          {inc.affectedASNs[0] && (
            <button type="button" className="btn" onClick={() => onOpenAsn(inc.affectedASNs[0].asn)} title={`Open AS${inc.affectedASNs[0].asn} in the ASN explorer`}>
              <Icon name="network" className="h-3.5 w-3.5" /> Explore AS{inc.affectedASNs[0].asn}
            </button>
          )}
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-fg-soft">{inc.description}</p>

        {/* Timing */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          {inc.aggregated ? (
            <div className="tile col-span-2 p-2.5">
              <div className="font-mono text-[10px] text-fg-mute">Observation window</div>
              <div className="mt-0.5 font-medium text-fg">Trailing 24 hours, refreshed hourly</div>
              <div className="tnum font-mono text-[10px] text-fg-mute">{formatUtcDateTime(inc.updatedAt)}</div>
            </div>
          ) : (
            <>
              <div className="tile p-2.5">
                <div className="font-mono text-[10px] text-fg-mute">Started</div>
                <div className="mt-0.5 font-medium text-fg">{formatRelative(inc.startedAt, t)}</div>
                <div className="tnum font-mono text-[10px] text-fg-mute">{formatUtcDateTime(inc.startedAt)}</div>
              </div>
              <div className="tile p-2.5">
                <div className="font-mono text-[10px] text-fg-mute">Duration</div>
                <div className="mt-0.5 font-medium text-fg">{formatDuration(inc.startedAt, endAt)}</div>
                <div className="font-mono text-[10px] text-fg-mute">{status === 'resolved' ? 'total' : 'and counting'}</div>
              </div>
            </>
          )}
        </div>

        {/* Facts reported by the source */}
        <div className="mt-4">
          <SectionTitle>Reported by {inc.sourceName}</SectionTitle>
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            {facts.map((f) => (
              <div key={f.label} className="tile px-2.5 py-1.5">
                <dt className="font-mono text-[10px] text-fg-mute">{f.label}</dt>
                <dd className="tnum m-0 text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Cable */}
        {inc.cable && (
          <div className="mt-4">
            <SectionTitle>Submarine cable</SectionTitle>
            <div className="tile p-2.5 text-[11px]">
              <div className="text-sm font-medium text-fg">{inc.cable.name}</div>
              <div className="mt-0.5 text-fg-mute">{inc.cable.owners}</div>
              <div className="tnum mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-fg-soft">
                <span>{formatKm(inc.cable.lengthKm)}</span>
                <span>{inc.cable.capacityTbps} Tbps</span>
                <span>RFS {inc.cable.rfs}</span>
              </div>
              <ol className="mt-2 space-y-1">
                {inc.cable.landings.map((l, i) => {
                  const faulted = i === inc.cable!.faultIndex || i === inc.cable!.faultIndex + 1;
                  return (
                    <li key={`${l.name}-${i}`} className="flex items-center gap-2">
                      <Dot color={faulted ? m.color : NEUTRAL.mark} className="h-1.5 w-1.5" />
                      <span className={faulted ? 'text-fg' : 'text-fg-mute'}>{l.name}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}

        {/* Paths */}
        {inc.path && inc.path.length > 0 && (
          <div className="mt-4">
            <SectionTitle>{inc.type === 'ddos' ? 'Attack flow' : 'Route propagation'}</SectionTitle>
            <ul className="m-0 space-y-1 p-0 text-[11px]">
              {inc.path.map((seg, i) => (
                <li key={i} className="tile flex items-center gap-2 px-2.5 py-1.5">
                  <span className="text-fg-soft">{seg.from.name}</span>
                  <Icon name="arrow-right" className="h-3 w-3 text-fg-mute" />
                  <span className="text-fg-soft">{seg.to.name}</span>
                  <span className="tnum ml-auto font-mono text-[10px] text-fg-mute">{seg.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ASNs */}
        {inc.affectedASNs.length > 0 && (
          <div className="mt-4">
            <SectionTitle>Networks involved</SectionTitle>
            <ul className="m-0 space-y-1 p-0 text-[11px]">
              {inc.affectedASNs.map((a) => (
                <li key={`${a.asn}-${a.role}`} className="tile flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-tile px-2.5 py-1.5 text-left transition-colors duration-200 ease-house hover:bg-white/[0.04]"
                    onClick={() => onOpenAsn(a.asn)}
                    title={`Open AS${a.asn} in the ASN explorer`}
                  >
                    <span className="tnum shrink-0 font-mono text-[10.5px] text-fg">AS{a.asn}</span>
                    <span className="truncate text-fg-soft">{a.name}</span>
                    <span className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] text-fg-soft" style={{ background: withAlpha(roleColor(a.role), 0.18) }}>{ROLE_LABEL[a.role]}</span>
                  </button>
                  <button type="button" className="rounded-full p-1.5 text-fg-mute transition-colors duration-200 ease-house hover:text-fg" onClick={() => onFilterAsn(a.asn)} title={`Filter the list to AS${a.asn}`} aria-label={`Filter incidents to AS${a.asn}`}>
                    <Icon name="filter" className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-4">
          <SectionTitle>Event timeline</SectionTitle>
          <ol className="relative m-0 ml-2 border-l border-line p-0 pl-4">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative mb-3 last:mb-0">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d0d]" style={{ background: eventColor(e.type, m.color) }} aria-hidden />
                <div className="flex items-baseline gap-2 font-mono text-[10px] text-fg-mute">
                  <span className="font-sans font-medium text-fg-soft">{titleCase(e.type)}</span>
                  <time dateTime={e.at} className="tnum">{formatUtcDateTime(e.at).slice(11)}</time>
                  <span className="ml-auto">{formatRelative(e.at, t)}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-fg-soft">{e.message}</div>
              </li>
            ))}
            {events.length === 0 && <li className="text-[11px] text-fg-mute">No events yet at this point in time.</li>}
          </ol>
        </div>

        <div className="tnum mt-4 flex items-center justify-between border-t border-line-soft pt-2 font-mono text-[10px] text-fg-mute">
          <span>{inc.id}</span>
          <span>updated {formatRelative(inc.updatedAt, t)}</span>
        </div>
      </div>
    </aside>
  );
}

function roleColor(role: string): string {
  switch (role) {
    case 'hijacker':
    case 'leaker': return STATUS_META.active.color;
    case 'victim': return STATUS_META.mitigating.color;
    case 'upstream': return TYPE_META.bgp.color;
    default: return SEVERITY_META.low.color;
  }
}

function eventColor(type: string, typeColor: string): string {
  switch (type) {
    case 'resolved': return STATUS_META.resolved.color;
    case 'mitigating': return STATUS_META.mitigating.color;
    case 'update': return NEUTRAL.mark;
    default: return typeColor;
  }
}
