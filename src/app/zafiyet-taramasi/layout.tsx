import type { Metadata } from 'next'

// Phase 6: /zafiyet-taramasi/page.tsx is a `'use client'` component, so
// it can't export `metadata` directly (Next.js App Router rule —
// metadata must come from a server component). This sibling layout.tsx
// is the minimal-impact way to attach a title to the route: it renders
// children unmodified and exists solely to surface metadata.
//
// Title: 'Sentinel' — the in-app brand name for the SOC dashboard +
// reports + CVE radar surface that lives at /zafiyet-taramasi.
// Renders as 'Sentinel · siberlab' via the root layout template.
export const metadata: Metadata = { title: 'Sentinel' }

export default function ZafiyetTaramasiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
