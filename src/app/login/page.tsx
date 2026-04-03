import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import EmbeddedLogin from '@/components/EmbeddedLogin'

export default async function LoginPage() {
  const cookieStore = cookies()
  const session = await getServerSessionFromCookies(cookieStore)
  if (session) redirect('/')
  return <EmbeddedLogin redirectTo="/home" />
}
