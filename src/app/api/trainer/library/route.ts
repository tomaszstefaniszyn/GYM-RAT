import { createLibraryExercise, listLibrary } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'
import { decodeDataImage } from '@/lib/image-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  return json({ exercises: await listLibrary() })
}

export async function POST(req: Request) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ name?: unknown; image?: unknown }>(req)
  if (!body || typeof body.name !== 'string') return json({ error: 'Podaj nazwę ćwiczenia.' }, 400)
  const image = decodeDataImage(body.image)
  if (image === false) return json({ error: 'Nieprawidłowe zdjęcie.' }, 400)
  try {
    const created = await createLibraryExercise(body.name, image ?? null)
    if ('error' in created) return json({ error: created.error }, 400)
    return json(created)
  } catch (error) {
    console.error('[gym-rat] biblioteka', error)
    return json({ error: 'Nie udało się dodać ćwiczenia.' }, 500)
  }
}
