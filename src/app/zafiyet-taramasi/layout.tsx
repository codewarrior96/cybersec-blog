import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getServerSessionFromCookies } from '@/lib/auth-server'

// Phase 6: /zafiyet-taramasi/page.tsx is a `'use client'` component, so
// it can't export `metadata` directly (Next.js App Router rule —
// metadata must come from a server component). This sibling layout.tsx
// surfaces the title AND (BUG-006) enforces the server-side auth gate.
//
// Title: 'Zafiyet Taraması' — matches the URL slug. The previous
// brand-name alias was retired in NAV-002 to align nav label, page
// title, and URL. Renders as 'Zafiyet Taraması · siberlab' via root layout.
//
// BUG-006: Until this gate shipped, any unauthenticated visitor
// hitting /zafiyet-taramasi directly received the SOC dashboard
// shell. Reports panel showed 401 (server APIs gate correctly), but
// the threat-map, CVE radar tabs, and breach timeline all rendered
// from local data — the surface itself leaked. Layout-level redirect
// closes that surface for anon users. API-route `requireSession`
// remains the authoritative validator (defense-in-depth).
export const metadata: Metadata = { title: 'Zafiyet Taraması' }

export default async function ZafiyetTaramasiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const session = await getServerSessionFromCookies(cookieStore)
  if (!session) {
    redirect('/login')
  }
  return <>{children}</>
}
