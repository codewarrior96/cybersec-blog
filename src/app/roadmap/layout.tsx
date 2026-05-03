import type { Metadata } from 'next'

// Phase 6 follow-up: /roadmap/page.tsx is a `'use client'` component,
// so it can't export `metadata` directly. This sibling layout.tsx is
// the minimal-impact way to attach a title to the route — same
// pattern used for /zafiyet-taramasi in Phase 6.
//
// Title: 'Roadmap' renders as 'Roadmap · siberlab' via the root
// layout's '%s · siberlab' template.
export const metadata: Metadata = { title: 'Roadmap' }

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
