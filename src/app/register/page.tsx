import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import EmbeddedRegister from '@/components/EmbeddedRegister'

export default async function RegisterPage() {
  const cookieStore = cookies()
  const session = await getServerSessionFromCookies(cookieStore)
  if (session) redirect('/portfolio?tab=profile')
  return <EmbeddedRegister redirectTo="/portfolio?tab=profile" />
}
