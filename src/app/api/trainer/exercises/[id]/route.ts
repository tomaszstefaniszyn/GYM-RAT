import { deleteExercise, updateExercise, type ExercisePatch } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEXT = ['cwiczenie', 'serie', 'reps', 'opis'] as const
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<Record<string, unknown>>(req)
  if (!body) return json({ error: 'Brak danych.' }, 400)
  const patch: ExercisePatch = {}
  for (const key of TEXT) {
    if (!(key in body)) continue
    if (typeof body[key] !== 'string') return json({ error: 'Nieprawidłowe pole.' }, 400)
    patch[key] = (body[key] as string).slice(0, 4000)
  }
  if ('done' in body) {
    if (typeof body.done !== 'boolean') return json({ error: 'Nieprawidłowe pole.' }, 400)
    patch.done = body.done
  }
  if (Object.keys(patch).length === 0) return json({ error: 'Brak zmian.' }, 400)
  const { id } = await ctx.params
  const row = await updateExercise(id, patch)
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  return json(row)
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const removed = await deleteExercise(id)
  if (!removed) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  return json({ ok: true })
}
