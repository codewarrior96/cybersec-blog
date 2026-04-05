import { cookies } from 'next/headers'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import EmbeddedLogin from '@/components/EmbeddedLogin'

export default async function LoginPage() {
  const cookieStore = cookies()
  await getServerSessionFromCookies(cookieStore)
  return <EmbeddedLogin redirectTo="/home" autoRedirectIfAuthenticated={false} />
}
