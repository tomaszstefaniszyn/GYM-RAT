import { setExerciseDoneForToken } from '@/lib/data'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ done?: unknown }>(req)
  if (typeof body?.done !== 'boolean') return json({ error: 'Nieprawidłowe pole.' }, 400)
  const { token, id } = await ctx.params
  const row = await setExerciseDoneForToken(token, id, body.done)
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  return json(row)
}
