import { getWorkoutForToken } from '@/lib/data'
import { json } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; workoutId: string }> }) {
  const { token, workoutId } = await ctx.params
  const workout = await getWorkoutForToken(token, workoutId)
  if (!workout) return json({ error: 'Nie znaleziono treningu.' }, 404)
  return json(workout)
}
