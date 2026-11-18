import { deleteWorkout, getWorkout, saveWorkoutPlan, type PlanSaveInput } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'
import { decodeDataImage } from '@/lib/image-payload'

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asId(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !UUID.test(value)) return false as const
  return value
}

function asText(value: unknown) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return false as const
  return value
}

export async function PUT(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ name?: unknown; blocks?: unknown }>(req)
  if (!body || !Array.isArray(body.blocks)) return json({ error: 'Brak danych.' }, 400)
  if (body.name !== undefined && typeof body.name !== 'string') return json({ error: 'Podaj nazwę treningu.' }, 400)

  const blocks: PlanSaveInput['blocks'] = []
  for (const rawBlock of body.blocks) {
    if (!rawBlock || typeof rawBlock !== 'object') return json({ error: 'Nieprawidłowy blok.' }, 400)
    const block = rawBlock as { id?: unknown; name?: unknown; exercises?: unknown }
    const id = asId(block.id)
    if (id === false) return json({ error: 'Nieprawidłowy blok.' }, 400)
    const name = asText(block.name)
    if (name === false) return json({ error: 'Nieprawidłowa nazwa bloku.' }, 400)
    if (!Array.isArray(block.exercises)) return json({ error: 'Nieprawidłowy blok.' }, 400)
    const exercises: PlanSaveInput['blocks'][number]['exercises'] = []
    for (const rawExercise of block.exercises) {
      if (!rawExercise || typeof rawExercise !== 'object') return json({ error: 'Nieprawidłowe ćwiczenie.' }, 400)
      const exercise = rawExercise as Record<string, unknown>
      const exerciseId = asId(exercise.id)
      if (exerciseId === false) return json({ error: 'Nieprawidłowe ćwiczenie.' }, 400)
      const cwiczenie = asText(exercise.cwiczenie)
      const serie = asText(exercise.serie)
      const reps = asText(exercise.reps)
      const opis = asText(exercise.opis)
      if (cwiczenie === false || serie === false || reps === false || opis === false) {
        return json({ error: 'Nieprawidłowe ćwiczenie.' }, 400)
      }
      if (exercise.done !== undefined && typeof exercise.done !== 'boolean') {
        return json({ error: 'Nieprawidłowe ćwiczenie.' }, 400)
      }
      const image = decodeDataImage(exercise.image)
      if (image === false) return json({ error: 'Nieprawidłowe zdjęcie.' }, 400)
      exercises.push({
        id: exerciseId,
        cwiczenie,
        serie,
        reps,
        opis,
        done: exercise.done === true,
        image,
      })
    }
    blocks.push({ id, name, exercises })
  }

  const { id } = await ctx.params
  const saved = await saveWorkoutPlan(id, { name: typeof body.name === 'string' ? body.name : '', blocks })
  if ('error' in saved) {
    const status = saved.error === 'Nie znaleziono treningu.' ? 404 : 400
    return json({ error: saved.error }, status)
  }
  return json(saved)
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
