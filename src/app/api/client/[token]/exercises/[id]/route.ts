import { setExerciseDoneForToken } from '@/lib/data'
import { forbidden, json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<Record<string, unknown>>(req)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Brak danych.' }, 400)
  const keys = Object.keys(body)
  if (keys.length === 0) return json({ error: 'Brak danych.' }, 400)
  if (keys.some((key) => key !== 'done')) return forbidden()
  if (typeof body.done !== 'boolean') return json({ error: 'Nieprawidłowe pole.' }, 400)
  const { token, id } = await ctx.params
  const row = await setExerciseDoneForToken(token, id, body.done)
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  return json(row)
}

export async function DELETE(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  return forbidden()
}
