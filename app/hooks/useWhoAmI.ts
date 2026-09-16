'use client';

import { useCallback, useState } from 'react';
import type { WhoAmI } from '@/app/utils/types';
import { fetchWhoAmI } from '@/app/utils/api';

export interface WhoAmIState {
  data: WhoAmI | null;
  loading: boolean;
  error: string | null;
  /** Opt-in lookup — nothing is resolved until the user asks. */
  lookup: () => Promise<WhoAmI | null>;
  clear: () => void;
}

export function useWhoAmI(): WhoAmIState {
  const [data, setData] = useState<WhoAmI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWhoAmI();
      setData(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, lookup, clear };
}
