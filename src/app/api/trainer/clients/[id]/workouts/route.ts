import { createWorkout, getClientRow } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const client = await getClientRow(id)
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)
  const body = await readBody<{ name?: string }>(req)
  const name = body?.name?.trim() ?? ''
  if (!name) return json({ error: 'Podaj nazwę treningu.' }, 400)
  if (name.length > 80) return json({ error: 'Nazwa jest za długa.' }, 400)
  const workout = await createWorkout(id, name)
  return json({ id: workout.id, name: workout.name, createdAt: workout.createdAt.toISOString() })
}
