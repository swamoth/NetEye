'use client';

import { useEffect, useState } from 'react';
import type { AsnProfile } from '@/app/utils/types';
import { ApiError } from '@/app/utils/api';

export interface AsnProfileState {
  data: AsnProfile | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const cache = new Map<number, AsnProfile>();

/** Loads /api/asn/:asn with a small client cache so re-opening an ASN is instant. */
export function useAsnProfile(asn: number | null): AsnProfileState {
  const [data, setData] = useState<AsnProfile | null>(asn ? cache.get(asn) ?? null : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!asn) { setData(null); setError(null); setLoading(false); return; }
    const cached = cache.get(asn);
    setData(cached ?? null);
    setError(null);
    if (cached && nonce === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/asn/${asn}`, { headers: { Accept: 'application/json' } });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText);
        if (cancelled) return;
        cache.set(asn, body as AsnProfile);
        setData(body as AsnProfile);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lookup failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [asn, nonce]);

  // Guard against one render of the previous network's data after `asn` changes.
  return { data: data && asn && data.asn === asn ? data : null, loading, error, reload: () => setNonce((n) => n + 1) };
}
