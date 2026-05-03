import type { Metadata } from 'next'
import EmbeddedRegister from '@/components/EmbeddedRegister'

export const metadata: Metadata = { title: 'Kayıt' }

export default async function RegisterPage() {
  return <EmbeddedRegister redirectTo="/auth/verify-pending" autoRedirectIfAuthenticated={false} />
}
