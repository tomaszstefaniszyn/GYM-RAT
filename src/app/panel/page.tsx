import { redirect } from 'next/navigation'
import { OpenInvite } from '@/components/client-home'
import { getClientTokenFromCookie } from '@/lib/auth'
import { getClientByToken } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const token = await getClientTokenFromCookie()
  if (token && (await getClientByToken(token))) redirect(`/c/${token}`)
  return (
    <main className="shell">
      <OpenInvite />
    </main>
  )
}
