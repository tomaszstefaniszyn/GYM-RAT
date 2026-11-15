import { deleteClient, getClientDetail } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const client = await getClientDetail(id)
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)
  return json(client)
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const removed = await deleteClient(id)
  if (!removed) return json({ error: 'Nie znaleziono klienta.' }, 404)
  return json({ ok: true })
}
