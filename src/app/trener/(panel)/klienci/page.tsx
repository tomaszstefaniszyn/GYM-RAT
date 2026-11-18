import { ClientsScreen } from '@/components/clients-screen'
import { listClients } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await listClients()
  return (
    <main className="shell flex-page">
      <ClientsScreen initial={clients} />
    </main>
  )
}
