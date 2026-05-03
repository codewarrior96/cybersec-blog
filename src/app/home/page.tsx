import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import HomePageClient from '@/components/HomePageClient'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const cookieStore = cookies()
  const session = await getServerSessionFromCookies(cookieStore)
  const initialAuth = Boolean(session)
  return <HomePageClient initialAuth={initialAuth} />
}
