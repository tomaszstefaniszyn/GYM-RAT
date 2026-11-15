import { deleteWorkout, getWorkout } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const workout = await getWorkout(id)
  if (!workout) return json({ error: 'Nie znaleziono treningu.' }, 404)
  return json(workout)
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const removed = await deleteWorkout(id)
  if (!removed) return json({ error: 'Nie znaleziono treningu.' }, 404)
  return json({ ok: true })
}
