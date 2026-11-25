import { eq } from 'drizzle-orm'
import { deleteStoredImage, storeExerciseImage } from '@/lib/avatar-storage'
import { getExerciseRow, readExerciseFile } from '@/lib/data'
import { getDb } from '@/lib/db'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'
import { fileResponse, readFormImage } from '@/lib/image-payload'
import { exercises } from '@/lib/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const row = await getExerciseRow(id, { migrate: false })
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  const file = await readExerciseFile(id, { migrate: false })
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return fileResponse(file, _req)
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const row = await getExerciseRow(id)
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  const incoming = await readFormImage(req)
  if (incoming instanceof Response) return incoming
  try {
    const stored = await storeExerciseImage(id, incoming.bytes, incoming.mime)
    const db = await getDb()
    await db
      .update(exercises)
      .set({ ...stored, updatedAt: new Date() })
      .where(eq(exercises.id, id))
    if (row.imagePath && row.imagePath !== stored.imagePath) await deleteStoredImage(row.imagePath)
    return json({ ok: true })
  } catch (error) {
    console.error('[gym-rat] zdjęcie ćwiczenia', error)
    return json({ error: 'Nie udało się zapisać zdjęcia.' }, 500)
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const row = await getExerciseRow(id)
  if (!row) return json({ error: 'Nie znaleziono ćwiczenia.' }, 404)
  const db = await getDb()
  await db
    .update(exercises)
    .set({ imageData: null, imageMime: null, imagePath: null, updatedAt: new Date() })
    .where(eq(exercises.id, id))
  await deleteStoredImage(row.imagePath)
  return json({ ok: true })
}
