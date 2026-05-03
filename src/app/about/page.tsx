import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

// Phase 6 follow-up: brand-consistent title for the redirect window.
// User typically never sees this tab (server-side 307 to /portfolio
// fires before the browser paints), but search-engine cached entries
// + tab-history previews still benefit from a real title.
export const metadata: Metadata = { title: 'Hakkında' }

export default function AboutRedirect() {
  redirect('/portfolio')
}