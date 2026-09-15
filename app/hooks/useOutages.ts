'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectionState, Incident, Snapshot, SourceStatus, WsMessage } from '@/app/utils/types';
import { fetchOutages, websocketUrl } from '@/app/utils/api';
import { applyUpdate } from '@/app/utils/incidents';

const POLL_MS = 15_000;
const WS_OPEN_TIMEOUT_MS = 4_000;
const WS_RETRY_BASE_MS = 3_000;
const WS_RETRY_MAX_MS = 60_000;

export interface OutagesState {
  incidents: Incident[];
  sources: SourceStatus[];
  connection: ConnectionState;
  /** Wall-clock ms of the last successful data receipt. */
  lastUpdate: number | null;
  refresh: () => Promise<void>;
}

/**
 * Live incident feed.
 *
 * 1. Seeds from the SSR snapshot (or an immediate REST fetch when none is given).
 * 2. Connects to the WebSocket server for snapshot + diff messages.
 * 3. If the socket is unavailable, polls /api/outages every 15 s and keeps retrying the socket
 *    with exponential back-off — the UI shows LIVE vs POLLING vs OFFLINE accordingly.
 */
export function useOutages(initial?: Snapshot | null): OutagesState {
  const [map, setMap] = useState<Map<string, Incident>>(() => new Map((initial?.incidents ?? []).map((i) => [i.id, i])));
  const [sources, setSources] = useState<SourceStatus[]>(initial?.sources ?? []);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastUpdate, setLastUpdate] = useState<number | null>(initial ? Date.parse(initial.now) : null);
  const hasInitial = useRef(Boolean(initial));

  const applySnapshot = useCallback((snap: Pick<Snapshot, 'incidents' | 'sources'>) => {
    setMap(new Map(snap.incidents.map((i) => [i.id, i])));
    setSources(snap.sources);
    setLastUpdate(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    const snap = await fetchOutages();
    applySnapshot(snap);
  }, [applySnapshot]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      try {
        const snap = await fetchOutages();
        if (closed) return;
        applySnapshot(snap);
        setConnection((c) => (c === 'live' ? c : 'polling'));
      } catch {
        if (!closed) setConnection('offline');
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      void poll();
      pollTimer = setInterval(poll, POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };
    const scheduleRetry = () => {
      if (closed) return;
      const delay = Math.min(WS_RETRY_MAX_MS, WS_RETRY_BASE_MS * 2 ** Math.min(attempts++, 4));
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (closed) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(websocketUrl());
      } catch {
        startPolling();
        scheduleRetry();
        return;
      }
      ws = socket;
      const openTimeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) socket.close();
      }, WS_OPEN_TIMEOUT_MS);

      socket.onopen = () => {
        clearTimeout(openTimeout);
        attempts = 0;
        setConnection('live');
        stopPolling();
      };
      socket.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(String(ev.data)) as WsMessage;
        } catch {
          return;
        }
        if (msg.type === 'snapshot') {
          applySnapshot(msg);
        } else if (msg.type === 'update') {
          setMap((prev) => applyUpdate(prev, msg.added, msg.updated, msg.removed));
          setSources(msg.sources);
          setLastUpdate(Date.now());
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        clearTimeout(openTimeout);
        if (ws === socket) ws = null;
        if (closed) return;
        setConnection('polling');
        startPolling();
        scheduleRetry();
      };
    };

    if (!hasInitial.current) void poll();
    // Deferred so React StrictMode's mount→unmount→mount cycle doesn't open a socket it
    // immediately has to close.
    const kickoff = setTimeout(connect, 50);

    return () => {
      closed = true;
      clearTimeout(kickoff);
      ws?.close();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [applySnapshot]);

  const incidents = useMemo(() => [...map.values()], [map]);
  return { incidents, sources, connection, lastUpdate, refresh };
}
