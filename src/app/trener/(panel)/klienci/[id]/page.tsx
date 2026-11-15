import { notFound } from 'next/navigation'
import { ClientScreen } from '@/components/client-screen'
import { getClientDetail } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClientDetail(id)
  if (!client) notFound()
  return (
    <main className="shell">
      <ClientScreen initial={client} />
    </main>
  )
}
