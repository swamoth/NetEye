'use client';

/**
 * Live BGP updates for one origin ASN, straight from RIPE RIS Live
 * (wss://ris-live.ripe.net) in the browser. No key, no server hop.
 *
 * Subscribes with `path: "<asn>$"` (updates whose AS path ends in the ASN, i.e. routes it
 * originates). Messages are buffered and flushed to React state twice a second so a busy
 * network (Cloudflare does ~1-2 updates/s, big transit ASNs far more) never floods renders.
 */

import { useEffect, useRef, useState } from 'react';
import { collectorFor } from '@/server/data/rrc';

export type RisStatus = 'idle' | 'connecting' | 'live' | 'error' | 'closed';

export interface RisUpdate {
  id: string;
  /** ms epoch */
  ts: number;
  host: string;
  collector: { name: string; city: string; cc: string; lat: number; lng: number } | null;
  peerAsn: number;
  path: number[];
  announced: string[];
  withdrawn: string[];
}

export interface RisLiveState {
  status: RisStatus;
  error: string | null;
  /** Newest first, capped. */
  updates: RisUpdate[];
  /** Updates per second for the last 60 s, oldest -> newest. */
  series: number[];
  totals: { messages: number; announcements: number; withdrawals: number; peers: number; collectors: number };
  since: number | null;
}

const RIS_URL = 'wss://ris-live.ripe.net/v1/ws/?client=neteye-web';
const KEEP = 60;
const FLUSH_MS = 500;
const WINDOW_S = 60;

const EMPTY: RisLiveState = { status: 'idle', error: null, updates: [], series: [], totals: { messages: 0, announcements: 0, withdrawals: 0, peers: 0, collectors: 0 }, since: null };

interface RisMessage {
  type: string;
  data?: {
    timestamp: number;
    peer_asn: string | number;
    id: string;
    host: string;
    type: string;
    path?: (number | number[])[];
    announcements?: { next_hop: string; prefixes: string[] }[];
    withdrawals?: string[];
    message?: string;
  };
}

export function useRisLive(asn: number | null, enabled: boolean): RisLiveState {
  const [state, setState] = useState<RisLiveState>(EMPTY);
  const buffer = useRef<RisUpdate[]>([]);
  const buckets = useRef(new Map<number, number>());
  const peers = useRef(new Set<number>());
  const collectors = useRef(new Set<string>());
  const totals = useRef({ messages: 0, announcements: 0, withdrawals: 0 });

  useEffect(() => {
    if (!asn || !enabled) {
      setState(EMPTY);
      return;
    }
    buffer.current = [];
    buckets.current = new Map();
    peers.current = new Set();
    collectors.current = new Set();
    totals.current = { messages: 0, announcements: 0, withdrawals: 0 };
    const since = Date.now();
    setState({ ...EMPTY, status: 'connecting', since });

    let ws: WebSocket | null = null;
    let closed = false;
    try {
      ws = new WebSocket(RIS_URL);
    } catch (err) {
      setState({ ...EMPTY, status: 'error', error: err instanceof Error ? err.message : 'WebSocket unavailable' });
      return;
    }

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'ris_subscribe', data: { path: `${asn}$`, type: 'UPDATE', socketOptions: { includeRaw: false } } }));
      setState((s) => ({ ...s, status: 'live' }));
    };
    ws.onmessage = (ev) => {
      let msg: RisMessage;
      try { msg = JSON.parse(String(ev.data)) as RisMessage; } catch { return; }
      if (msg.type === 'ris_error') {
        setState((s) => ({ ...s, status: 'error', error: msg.data?.message ?? 'RIS Live rejected the subscription' }));
        return;
      }
      if (msg.type !== 'ris_message' || !msg.data || msg.data.type !== 'UPDATE') return;
      const d = msg.data;
      const path = (d.path ?? []).flat().map(Number).filter(Number.isFinite);
      // The server-side `path` filter is a pattern, so "13335$" also matches AS113335: check the origin.
      if (path.length && path[path.length - 1] !== asn) return;
      const announced = (d.announcements ?? []).flatMap((a) => a.prefixes ?? []);
      const withdrawn = d.withdrawals ?? [];
      const ts = Math.round((d.timestamp ?? Date.now() / 1000) * 1000);
      const peerAsn = Number(d.peer_asn);
      const up: RisUpdate = { id: d.id, ts, host: d.host, collector: collectorFor(d.host) ?? null, peerAsn, path, announced, withdrawn };
      // Collectors deliver out of order by a few seconds; keep the buffer sorted newest first.
      const at = buffer.current.findIndex((x) => x.ts <= ts);
      buffer.current.splice(at === -1 ? buffer.current.length : at, 0, up);
      if (buffer.current.length > KEEP) buffer.current.length = KEEP;
      const sec = Math.floor(Date.now() / 1000);
      buckets.current.set(sec, (buckets.current.get(sec) ?? 0) + 1);
      peers.current.add(peerAsn);
      if (d.host) collectors.current.add(d.host);
      totals.current.messages += 1;
      totals.current.announcements += announced.length;
      totals.current.withdrawals += withdrawn.length;
    };
    ws.onerror = () => setState((s) => (s.status === 'live' ? s : { ...s, status: 'error', error: 'Could not reach RIS Live' }));
    ws.onclose = () => { if (!closed) setState((s) => ({ ...s, status: s.status === 'error' ? 'error' : 'closed' })); };

    const flush = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      for (const k of buckets.current.keys()) if (k < nowSec - WINDOW_S) buckets.current.delete(k);
      const series: number[] = [];
      for (let s = nowSec - WINDOW_S + 1; s <= nowSec; s++) series.push(buckets.current.get(s) ?? 0);
      setState((prev) => ({
        ...prev,
        updates: buffer.current.slice(),
        series,
        totals: { ...totals.current, peers: peers.current.size, collectors: collectors.current.size },
      }));
    }, FLUSH_MS);

    return () => {
      closed = true;
      clearInterval(flush);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [asn, enabled]);

  return state;
}
