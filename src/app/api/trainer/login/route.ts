import { requestTrainerLogin } from '@/lib/auth'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ email?: string; password?: string }>(req)
  if (!body?.email?.trim()) return json({ error: 'Podaj adres e-mail.' }, 400)
  if (typeof body.password !== 'string' || body.password.length === 0) return json({ error: 'Podaj hasło.' }, 400)
  const result = await requestTrainerLogin(body.email, body.password)
  if (!result.ok) {
    const status = result.error.startsWith('Podaj') ? 400 : 401
    return json({ error: result.error }, status)
  }
  return json({ ok: true })
}
