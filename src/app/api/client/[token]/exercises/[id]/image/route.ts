import { getExerciseImageForToken } from '@/lib/data'
import { forbidden, json, rejectCrossSite } from '@/lib/http'
import { fileResponse } from '@/lib/image-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string; id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { token, id } = await ctx.params
  const file = await getExerciseImageForToken(token, id)
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return fileResponse(file, _req)
}

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  return forbidden()
}

export async function DELETE(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  return forbidden()
}
