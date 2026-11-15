import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getTrainerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TrainerLoginPage() {
  const session = await getTrainerSession()
  if (session) redirect('/trener/klienci')
  return (
    <main className="shell">
      <LoginForm />
    </main>
  )
}
