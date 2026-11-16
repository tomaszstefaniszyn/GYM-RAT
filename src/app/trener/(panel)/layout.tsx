import { redirect } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TrainerPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getTrainerSession()
  if (!session) redirect('/trener')
  return children
}
