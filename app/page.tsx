import App from './components/App';
import { getSnapshot } from '@/lib/incidents';
import type { Snapshot } from './utils/types';

export const dynamic = 'force-dynamic';

/**
 * The globe *is* the landing page. This server component fetches the initial 24h snapshot
 * directly from the aggregator so the incident list and KPIs are in the first HTML; the WebGL
 * globe streams in client-side behind the boot overlay.
 */
export default async function Page() {
  let initial: Snapshot | null = null;
  try {
    initial = await getSnapshot();
  } catch (err) {
    console.error('[neteye] initial snapshot failed, client will fetch', err);
  }
  return <App initial={initial} />;
}
