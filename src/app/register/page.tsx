import EmbeddedRegister from '@/components/EmbeddedRegister'

export default async function RegisterPage() {
  return <EmbeddedRegister redirectTo="/auth/verify-pending" autoRedirectIfAuthenticated={false} />
}
