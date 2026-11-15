import { createExercise, getWorkout } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const workout = await getWorkout(id)
  if (!workout) return json({ error: 'Nie znaleziono treningu.' }, 404)
  return json(await createExercise(id))
}
