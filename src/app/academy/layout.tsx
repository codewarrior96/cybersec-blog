import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getServerSessionFromCookies } from '@/lib/auth-server'

// BUG-006 — Server-side auth gate for /academy (formerly /community).
//
// A-26 closure (Wave 12): route renamed from /community → /academy.
// The semantic mismatch (page content is training/education, not a
// community forum) drove the operator rename. Auth gate behavior
// PRESERVED — same cookies() + session-check + redirect('/login')
// pattern that closed BUG-006 in Wave 4B. Only the URL segment moved;
// the Wave 4B R-E2E-02 PARTIAL closure narrative carries forward
// unchanged at the new path. Pre-existing /community URLs route here
// via the 308 redirect in next.config.mjs.
//
// /academy/page.tsx is a 2146-line `'use client'` component (lab
// content, terminal, CTF flags). Until this layout shipped, any
// unauthenticated visitor hitting /community (the former path)
// directly received the full lab payload — no redirect, no gate. The
// page never called any auth-gated API on first paint, so there was
// no 401 to reveal the hole; the entire learning surface rendered to
// anonymous users.
//
// Next.js App Router runs server-side layouts on every navigation
// that touches this segment, including direct URL hits and Link
// prefetches. Doing the session check here is the cheapest, most
// reliable place to enforce the gate without touching the 2146-line
// client component.
//
// Defense-in-depth: API routes still enforce `requireSession` at the
// route handler level (Audit H5), and middleware still gates /api/*
// mutations at the edge. This layout adds the missing page-level
// layer.

export const metadata: Metadata = { title: 'Academy' }

export default async function AcademyLayout({
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
