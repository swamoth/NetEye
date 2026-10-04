/**
 * Social preview card (1200x630), rendered on the server with next/og.
 *
 * The card carries live numbers: how many incidents are in the 24 h window right now, how many
 * are high or critical, and how many countries are affected. A link shared on LinkedIn, Reddit,
 * X, Slack or WhatsApp therefore shows the state of the internet at the moment it was shared.
 *
 * The snapshot call is bounded: if the aggregator does not answer in SNAPSHOT_TIMEOUT_MS the card
 * is drawn without the counts, because a crawler gives up long before an upstream API does.
 * The result is cached for `revalidate` seconds, so crawlers do not drive the upstream feeds.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getSnapshot } from '@/lib/incidents';
import { siteUrl } from '@/app/utils/site';

export const runtime = 'nodejs';
export const revalidate = 300;
export const alt = 'NetEye: live internet incidents on a globe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SNAPSHOT_TIMEOUT_MS = 2500;

const PAPER = '#101010';
const FG = '#f5f5f5';
const FG_SOFT = '#a0a0a0';
const FG_MUTE = '#787878';
const LINE = '#2e2e2e';

/** The wire globe from app/components/Logo.tsx. Satori draws SVG from a data URI, not inline. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="30" cy="34" r="21"/><path d="M11.4 25.5h37.2M9 34h42M11.4 42.5h37.2"/>
<path d="M21.5 15.4v37.2M30 13v42M38.5 15.4v37.2"/>
<path d="M13 44c-7 3-9 12 0 12 12 0 30-18 45-38"/>
<path d="M55 6v12M49 12h12M50.8 7.8l8.4 8.4M59.2 7.8l-8.4 8.4"/></svg>`;
const markUri = `data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`;

interface Figures {
  active: number;
  severe: number;
  countries: number;
}

/** Live counts, or null when the feed is slow or unavailable. The card works either way. */
async function figures(): Promise<Figures | null> {
  try {
    const snap = await Promise.race([
      getSnapshot(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS)),
    ]);
    if (!snap) return null;
    const live = snap.incidents.filter((i) => i.status !== 'resolved');
    return {
      active: live.length,
      severe: live.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
      countries: new Set(live.map((i) => i.location.country).filter(Boolean)).size,
    };
  } catch {
    return null;
  }
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 60, color: FG, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 17, color: FG_MUTE, letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

/**
 * Geist Mono, or nothing. The files are read with fs, which the build tracer cannot see, so
 * next.config.js names them in outputFileTracingIncludes. If that ever stops working the card
 * falls back to the renderer's built-in font: a plain card beats a broken one.
 */
async function fonts() {
  try {
    const [medium, regular] = await Promise.all([
      readFile(join(process.cwd(), 'assets/GeistMono-Medium.ttf')),
      readFile(join(process.cwd(), 'assets/GeistMono-Regular.ttf')),
    ]);
    return [
      { name: 'Geist Mono', data: medium, weight: 500 as const, style: 'normal' as const },
      { name: 'Geist Mono', data: regular, weight: 400 as const, style: 'normal' as const },
    ];
  } catch (err) {
    console.log('social card: fonts unavailable,', (err as Error).message);
    return undefined;
  }
}

export default async function Image() {
  const host = siteUrl().replace(/^https?:\/\//, '');
  const [typefaces, live] = await Promise.all([fonts(), figures()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '64px 72px',
          fontFamily: 'Geist Mono',
          // A faint vignette, the same shape the app draws over the globe.
          backgroundImage: `radial-gradient(900px 620px at 72% 46%, #1a1a1a 0%, ${PAPER} 68%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Satori renders this card, not a browser: next/image does not apply here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markUri} width={54} height={54} alt="" />
          <div style={{ fontSize: 40, color: FG, letterSpacing: '-0.02em' }}>NetEye</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: 9, background: live ? '#4ade80' : FG_MUTE }} />
            <div style={{ fontSize: 19, color: FG_SOFT, letterSpacing: '0.04em' }}>{live ? 'LIVE' : 'REAL FEEDS'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
          <div style={{ fontSize: 54, color: FG, lineHeight: 1.15, letterSpacing: '-0.025em' }}>
            Live internet incidents on a globe
          </div>
          <div style={{ fontSize: 23, color: FG_SOFT, lineHeight: 1.45 }}>
            Outages, BGP hijacks and leaks, and DDoS activity from the last 24 hours, with replay
            and an ASN explorer.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, borderTop: `1px solid ${LINE}`, paddingTop: 28 }}>
          {live ? (
            <div style={{ display: 'flex', gap: 76 }}>
              <Figure value={String(live.active)} label="ACTIVE INCIDENTS" />
              <Figure value={String(live.severe)} label="HIGH AND CRITICAL" />
              <Figure value={String(live.countries)} label="COUNTRIES AFFECTED" />
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 17, color: FG_MUTE, letterSpacing: '0.04em' }}>
            <div>CLOUDFLARE RADAR · IODA · RIPESTAT · RIPE RIS LIVE</div>
            <div style={{ flex: 1 }} />
            <div>{host}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: typefaces },
  );
}
