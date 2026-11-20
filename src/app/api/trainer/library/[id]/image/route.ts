import { getLibraryImage } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json } from '@/lib/http'
import { fileResponse } from '@/lib/image-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const file = await getLibraryImage(id)
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return fileResponse(file)
}
