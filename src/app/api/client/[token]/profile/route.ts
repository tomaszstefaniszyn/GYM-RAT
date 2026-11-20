import { getProfileByToken, updateProfile } from '@/lib/data'
import { json, readBody, rejectCrossSite } from '@/lib/http'
import { clientPassChangeRejected, validateProfile } from '@/lib/pass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const profile = await getProfileByToken(token)
  if (!profile) return json({ error: 'Nie znaleziono planu.' }, 404)
  return json(profile)
}

export async function PATCH(req: Request, ctx: Ctx) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { token } = await ctx.params
  const existing = await getProfileByToken(token)
  if (!existing) return json({ error: 'Nie znaleziono planu.' }, 404)
  const body = await readBody<unknown>(req)
  const parsed = validateProfile(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  if (
    clientPassChangeRejected(body, {
      passType: existing.passType,
      trainingStart: existing.trainingStart,
      passUsed: existing.passUsed,
    })
  ) {
    return json({ error: 'Nie możesz zmieniać danych karnetu.' }, 403)
  }
  const profile = await updateProfile(existing.id, {
    ...parsed.value,
    passType: existing.passType,
    trainingStart: existing.trainingStart,
    passUsed: existing.passUsed,
  })
  if (!profile) return json({ error: 'Nie znaleziono planu.' }, 404)
  return json(profile)
}
