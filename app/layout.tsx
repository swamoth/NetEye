import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NetEye - Real-Time Internet Outage Visualization',
  description: 'Track internet outages, submarine cable cuts, and network incidents in real-time on an interactive 3D globe',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">{children}</body>
    </html>
  )
}
