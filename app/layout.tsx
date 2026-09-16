import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'NetEye: live internet incidents on a globe',
  description:
    'Outages, BGP route leaks and hijacks, and DDoS activity from the last 24 hours, plotted live on a 3D globe from Cloudflare Radar and RIPE data, with replay and an ASN explorer.',
  applicationName: 'NetEye',
  keywords: ['internet outages', 'BGP', 'RPKI', 'DDoS', 'network monitoring', 'Cloudflare Radar', 'RIPE RIS'],
  alternates: { types: { 'application/rss+xml': '/api/feed' } },
  openGraph: {
    title: 'NetEye: live internet incidents on a globe',
    description: 'Outages, BGP anomalies and DDoS activity, live from real feeds.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#101010',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh overflow-hidden bg-paper text-fg">
        <a href="#incident-list" className="skip-link">Skip to incident list</a>
        {children}
      </body>
    </html>
  );
}
