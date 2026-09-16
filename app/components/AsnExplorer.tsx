'use client';

import type { AsnProfile, NeighbourType } from '@/app/utils/types';
import type { AsnProfileState } from '@/app/hooks/useAsnProfile';
import type { RisLiveState } from '@/app/hooks/useRisLive';
import { ACCENT, NEUTRAL, STATUS_META, TYPE_META } from '@/app/utils/theme';
import { formatCompact, formatNumber, formatPct, formatRelative, formatUtcTime } from '@/app/utils/format';
import { Sparkline, StackedBar } from './charts';
import { Dot, EmptyState, Icon, SectionTitle, Skeleton, Stat } from './ui';
import MetalSurface from './MetalSurface';

export interface AsnExplorerProps {
  asn: number;
  profile: AsnProfileState;
  ris: RisLiveState;
  watching: boolean;
  incidentCount: number;
  now: number;
  onToggleWatch: () => void;
  onClose: () => void;
  onFlyTo: () => void;
  onCopyLink: () => void;
  onOpenAsn: (asn: number) => void;
  onFilterIncidents: () => void;
}

const NEIGHBOUR_LABEL: Record<NeighbourType, string> = { upstream: 'Upstream', downstream: 'Downstream', uncertain: 'Peer or unclear' };
export const NEIGHBOUR_COLOR: Record<NeighbourType, string> = { upstream: ACCENT, downstream: '#8a8a8a', uncertain: '#4a4a4a' };

export default function AsnExplorer(p: AsnExplorerProps) {
  const d = p.profile.data;
  const title = d?.name ? `AS${p.asn} · ${d.name}` : `AS${p.asn}`;

  return (
    <aside className="bar pointer-events-auto absolute bottom-[7.5rem] right-3 top-[4.25rem] z-20 flex w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-clip motion-safe:animate-fadeUp md:right-4" aria-label="ASN explorer" aria-busy={p.profile.loading}>
      <div className="h-[2px] w-full bg-fg/80" aria-hidden />
      <div className="flex items-start gap-2 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="mono-label">Autonomous system</div>
          <h2 className="mt-0.5 truncate text-[15px] font-medium leading-snug tracking-[-0.01em] text-fg" title={title}>{title}</h2>
          {d && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-fg-mute">
              {d.org && d.org !== d.name && <span className="truncate">{d.org}</span>}
              {d.country && <span>{d.country}</span>}
              {d.website && <a className="truncate text-fg-soft underline decoration-line underline-offset-2 transition-colors duration-200 ease-house hover:text-fg" href={d.website.startsWith('http') ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\//, '')}</a>}
            </div>
          )}
        </div>
        <button type="button" className="group press -mr-0.5 -mt-0.5 rounded-full" onClick={p.onClose} aria-label="Close ASN explorer">
          <MetalSurface size={32}><Icon name="close" className="h-[15px] w-[15px]" /></MetalSurface>
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn" onClick={p.onToggleWatch} aria-pressed={p.watching} title="Stream BGP updates for routes this network originates, live from RIPE RIS">
            {p.watching ? <Dot color={STATUS_META.resolved.color} className="motion-safe:animate-livePulse" /> : <Icon name="live" className="h-3.5 w-3.5" />} {p.watching ? 'Watching live BGP' : 'Watch live BGP'}
          </button>
          <button type="button" className="btn" onClick={p.onFlyTo} disabled={!d?.location}><Icon name="globe" className="h-3.5 w-3.5" /> Fly to</button>
          <button type="button" className="btn" onClick={p.onCopyLink}><Icon name="link" className="h-3.5 w-3.5" /> Copy link</button>
          <button type="button" className="btn" onClick={p.onFilterIncidents} title="Filter the incident list to this network">
            <Icon name="filter" className="h-3.5 w-3.5" /> Incidents <span className="tnum font-mono text-[10px] text-fg-mute">{p.incidentCount}</span>
          </button>
          <a className="btn" href={`https://radar.cloudflare.com/routing/as${p.asn}`} target="_blank" rel="noreferrer"><Icon name="external" className="h-3.5 w-3.5" /> Radar</a>
          <a className="btn" href={`https://stat.ripe.net/AS${p.asn}`} target="_blank" rel="noreferrer"><Icon name="external" className="h-3.5 w-3.5" /> RIPEstat</a>
        </div>

        {p.profile.loading && !d && <LoadingSkeleton />}

        {p.profile.error && !d && (
          <EmptyState icon="warning" title={`Could not load AS${p.asn}`} body={p.profile.error} action={<button type="button" className="btn" onClick={p.profile.reload}>Try again</button>} />
        )}

        {d && <Profile d={d} now={p.now} onOpenAsn={p.onOpenAsn} />}

        {/* Live BGP */}
        <div className="mt-4">
          <SectionTitle right={<RisStatusPill ris={p.ris} watching={p.watching} />}>Live BGP updates</SectionTitle>
          {!p.watching ? (
            <p className="text-[11px] leading-relaxed text-fg-mute">
              Turn on <span className="text-fg-soft">Watch live BGP</span> to stream announcements and withdrawals for routes originated by AS{p.asn}, as seen by RIPE RIS collectors worldwide. Each update is drawn on the globe from the collector that observed it.
            </p>
          ) : (
            <LiveBgp ris={p.ris} now={p.now} />
          )}
        </div>
      </div>
    </aside>
  );
}

function Profile({ d, now, onOpenAsn }: { d: AsnProfile; now: number; onOpenAsn: (asn: number) => void }) {
  const vis = d.visibility;
  const visPct = vis && vis.v4.total ? Math.round((vis.v4.seeing / vis.v4.total) * 100) : null;
  const rpki = d.rpki;
  const validPct = rpki && rpki.total ? (rpki.valid / rpki.total) * 100 : null;
  const neighbourTotal = d.neighbours.counts.unique || d.neighbours.counts.upstream + d.neighbours.counts.downstream + d.neighbours.counts.uncertain;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Announced prefixes" value={d.prefixes.v4 == null && d.prefixes.v6 == null ? 'n/a' : formatCompact((d.prefixes.v4 ?? 0) + (d.prefixes.v6 ?? 0))} sub={d.prefixes.v4 == null && d.prefixes.v6 == null ? 'RIPEstat did not answer in time' : `${formatNumber(d.prefixes.v4)} IPv4, ${formatNumber(d.prefixes.v6)} IPv6`} title="RIPEstat routing-status" />
        <Stat label="RIS visibility" value={visPct == null ? 'n/a' : `${visPct}%`} sub={vis ? `${vis.v4.seeing} of ${vis.v4.total} IPv4 peers see it` : 'RIPEstat routing-status did not answer in time (common for very large networks)'} title="Share of RIS full-feed peers that see this network's IPv4 space" />
        <Stat label="Neighbours" value={formatNumber(neighbourTotal)} sub={`${d.neighbours.counts.upstream} upstream, ${d.neighbours.counts.downstream} downstream`} title="Adjacent ASNs observed in AS paths (RIPEstat)" />
        <Stat label={d.estimatedUsers != null ? 'Estimated users' : 'Anomalies, 7 days'} value={d.estimatedUsers != null ? formatCompact(d.estimatedUsers) : formatNumber(d.anomalies.length)} sub={d.estimatedUsers != null ? 'Cloudflare Radar estimate' : 'hijacks and leaks involving this AS'} />
      </div>

      {/* RPKI */}
      <div className="mt-4">
        <SectionTitle right={rpki ? 'Cloudflare Radar route stats' : undefined}>Route origin validation (RPKI)</SectionTitle>
        {rpki ? (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-fg">{validPct == null ? 'n/a' : formatPct(validPct, validPct >= 99.5 && validPct < 100 ? 1 : 0)}</span>
              <span className="font-mono text-[10.5px] text-fg-mute">of {formatNumber(rpki.total)} observed routes are RPKI-valid</span>
            </div>
            <StackedBar
              ariaLabel={`RPKI validation state of ${rpki.total} routes announced by AS${d.asn}`}
              segments={[
                { key: 'valid', label: 'Valid', value: rpki.valid, color: STATUS_META.resolved.color },
                { key: 'invalid', label: 'Invalid', value: rpki.invalid, color: STATUS_META.active.color },
                { key: 'unknown', label: 'No ROA', value: rpki.unknown, color: NEUTRAL.mark },
              ]}
              format={formatNumber}
            />
            {rpki.invalid > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-200">
                <Icon name="shield-warning" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {formatNumber(rpki.invalid)} route{rpki.invalid === 1 ? '' : 's'} fail origin validation. Networks that drop invalids will not reach those prefixes via this origin.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-fg-mute">{d.sources.radar === 'disabled' ? 'Add a Cloudflare Radar token to see RPKI validation counts.' : 'Cloudflare Radar returned no route statistics for this network.'}</p>
        )}
      </div>

      {/* Neighbours */}
      {d.neighbours.top.length > 0 && (
        <div className="mt-4">
          <SectionTitle right="by paths observed">Top neighbours</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-fg-mute">
            {(['upstream', 'downstream', 'uncertain'] as NeighbourType[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><Dot color={NEIGHBOUR_COLOR[k]} className="h-1.5 w-1.5" />{NEIGHBOUR_LABEL[k]}</span>
            ))}
          </div>
          <ul className="m-0 space-y-1 p-0">
            {d.neighbours.top.slice(0, 10).map((n) => {
              const max = d.neighbours.top[0]?.power || 1;
              return (
                <li key={`${n.asn}-${n.type}`}>
                  <button type="button" className="block w-full rounded-block px-1.5 py-1 text-left transition-colors duration-200 ease-house hover:bg-white/[0.04]" onClick={() => onOpenAsn(n.asn)} title={`Open AS${n.asn}`}>
                    <div className="flex items-baseline gap-2 text-[11px]">
                      <Dot color={NEIGHBOUR_COLOR[n.type]} className="h-1.5 w-1.5 self-center" />
                      <span className="tnum font-mono text-[10.5px] text-fg">AS{n.asn}</span>
                      <span className="truncate text-fg-soft">{n.name ?? ''}</span>
                      {n.countryCode && <span className="font-mono text-[10px] text-fg-mute">{n.countryCode}</span>}
                      <span className="tnum ml-auto shrink-0 font-mono text-[10.5px] text-fg-soft">{formatCompact(n.power)}</span>
                    </div>
                    <div className="mt-1 h-[5px] w-full rounded-[3px]" style={{ background: NEUTRAL.track }}>
                      <div className="h-full rounded-r-[3px]" style={{ width: `${Math.max(2, (n.power / max) * 100)}%`, background: NEIGHBOUR_COLOR[n.type] }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Anomalies */}
      <div className="mt-4">
        <SectionTitle right="7 days, Cloudflare Radar">Routing anomalies</SectionTitle>
        {d.anomalies.length === 0 ? (
          <p className="text-[11px] text-fg-mute">{d.sources.radar === 'ok' ? 'No hijack or leak events involving this network in the last 7 days.' : 'Anomaly history needs a Cloudflare Radar token.'}</p>
        ) : (
          <ul className="m-0 space-y-1 p-0 text-[11px]">
            {d.anomalies.slice(0, 8).map((a) => (
              <li key={a.id} className="tile px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Dot color={TYPE_META.bgp.color} className="h-1.5 w-1.5" />
                  <span className="font-medium text-fg">{a.kind === 'hijack' ? 'Possible hijack' : 'Route leak'}</span>
                  <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[10px] text-fg-soft">{a.role}</span>
                  <time className="ml-auto font-mono text-[10px] text-fg-mute" dateTime={a.startedAt}>{formatRelative(a.startedAt, now)}</time>
                </div>
                <div className="mt-0.5 text-fg-soft">{a.title}{a.score != null ? `, score ${a.score} of 12` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Prefix sample */}
      {d.prefixes.sample.length > 0 && (
        <div className="mt-4">
          <SectionTitle right="RIPEstat announced-prefixes">Announced prefixes, sample</SectionTitle>
          <ul className="m-0 grid grid-cols-2 gap-x-3 gap-y-0.5 p-0 font-mono text-[11px] text-fg-soft">
            {d.prefixes.sample.map((pfx) => <li key={pfx} className="truncate" title={pfx}>{pfx}</li>)}
          </ul>
        </div>
      )}

      <div className="tnum mt-4 flex items-center justify-between border-t border-line-soft pt-2 font-mono text-[10px] text-fg-mute">
        <span>RIPEstat {d.sources.ripestat}, Radar {d.sources.radar}</span>
        <span>fetched {formatRelative(d.fetchedAt, now)}</span>
      </div>
    </>
  );
}

function RisStatusPill({ ris, watching }: { ris: RisLiveState; watching: boolean }) {
  if (!watching) return <span>RIPE RIS Live</span>;
  const meta = {
    idle: { color: NEUTRAL.mark, label: 'idle' },
    connecting: { color: NEUTRAL.mark, label: 'connecting' },
    live: { color: STATUS_META.resolved.color, label: 'streaming' },
    error: { color: STATUS_META.active.color, label: 'error' },
    closed: { color: STATUS_META.mitigating.color, label: 'closed' },
  }[ris.status];
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-soft" title={ris.error ?? undefined}>
      <Dot color={meta.color} className={ris.status === 'live' ? 'motion-safe:animate-livePulse' : ''} />
      {meta.label}
    </span>
  );
}

function LiveBgp({ ris, now }: { ris: RisLiveState; now: number }) {
  if (ris.status === 'error') {
    return <p className="text-[11px] text-amber-200">{ris.error ?? 'RIS Live is not reachable from this browser.'}</p>;
  }
  const perMin = ris.series.reduce((s, v) => s + v, 0);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Updates per minute" value={formatNumber(perMin)} sub={ris.since ? `since ${formatUtcTime(ris.since, false)} UTC` : undefined} />
        <Stat label="Announcements" value={formatCompact(ris.totals.announcements)} sub="prefixes" />
        <Stat label="Withdrawals" value={formatCompact(ris.totals.withdrawals)} sub="prefixes" />
      </div>
      <div className="tile mt-2 p-2.5">
        <div className="mb-1 flex justify-between font-mono text-[10px] text-fg-mute">
          <span>Updates per second, last 60 s</span>
          <span className="tnum">{ris.totals.peers} peers, {ris.totals.collectors} collectors</span>
        </div>
        <Sparkline data={ris.series} color={ACCENT} ariaLabel="BGP updates per second over the last minute" />
      </div>
      {ris.updates.length === 0 ? (
        <p className="mt-2 text-[11px] text-fg-mute">{ris.status === 'live' ? 'Connected. Waiting for the first update for this origin.' : 'Connecting to ris-live.ripe.net.'}</p>
      ) : (
        <ul className="m-0 mt-2 space-y-1 p-0 text-[11px]" aria-live="off">
          {ris.updates.slice(0, 8).map((u) => (
            <li key={u.id} className="tile flex items-center gap-2 px-2 py-1">
              <Dot color={u.withdrawn.length && !u.announced.length ? STATUS_META.active.color : STATUS_META.resolved.color} className="h-1.5 w-1.5" />
              <time className="tnum font-mono text-[10.5px] text-fg-mute" dateTime={new Date(u.ts).toISOString()}>{formatUtcTime(u.ts)}</time>
              <span className="truncate text-fg-soft" title={`Observed at ${u.host}`}>{u.collector ? u.collector.city : u.host.replace('.ripe.net', '')}</span>
              <span className="tnum font-mono text-[10.5px] text-fg-mute">via AS{u.peerAsn}</span>
              <span className="tnum ml-auto shrink-0 font-mono text-[10.5px] text-fg-soft">
                {u.announced.length ? `+${u.announced.length}` : ''}{u.announced.length && u.withdrawn.length ? ' ' : ''}{u.withdrawn.length ? `-${u.withdrawn.length}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-mono text-[10px] text-fg-mute">Path length {ris.updates[0] ? ris.updates[0].path.length : 'n/a'} on the latest update. Times are UTC; last seen {ris.updates[0] ? formatRelative(ris.updates[0].ts, now) : 'never'}.</p>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-3 space-y-3" aria-hidden>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-1.5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)}</div>
    </div>
  );
}

