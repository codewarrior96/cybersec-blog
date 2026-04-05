import EmbeddedRegister from '@/components/EmbeddedRegister'

export default async function RegisterPage() {
  return <EmbeddedRegister redirectTo="/portfolio?tab=profile" autoRedirectIfAuthenticated={false} />
}
