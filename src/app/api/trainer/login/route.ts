import { requestTrainerLogin } from '@/lib/auth'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ email?: string }>(req)
  if (!body?.email?.trim()) return json({ error: 'Podaj adres e-mail.' }, 400)
  const result = await requestTrainerLogin(body.email)
  if (!result.ok) return json({ error: result.error }, 401)
  return json({ ok: true })
}
