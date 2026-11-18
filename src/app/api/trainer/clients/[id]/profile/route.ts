import { getProfile, updateProfile } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, readBody, rejectCrossSite } from '@/lib/http'
import { validateProfile } from '@/lib/pass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const profile = await getProfile(id)
  if (!profile) return json({ error: 'Nie znaleziono klienta.' }, 404)
  return json(profile)
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const existing = await getProfile(id)
  if (!existing) return json({ error: 'Nie znaleziono klienta.' }, 404)
  const body = await readBody<unknown>(req)
  const parsed = validateProfile(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const profile = await updateProfile(id, parsed.value)
  if (!profile) return json({ error: 'Nie znaleziono klienta.' }, 404)
  return json(profile)
}
