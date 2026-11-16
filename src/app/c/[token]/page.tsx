import { ClientHome, InvalidLink } from '@/components/client-home'
import { getClientHome } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ClientEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const home = await getClientHome(token)
  if (!home) {
    return (
      <main className="shell">
        <InvalidLink />
      </main>
    )
  }
  return (
    <main className="shell">
      <ClientHome token={token} initial={home} />
    </main>
  )
}
