import { setClientCookie } from '@/lib/auth'
import { getClientByToken } from '@/lib/data'
import { json, readBody, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const body = await readBody<{ token?: string }>(req)
  const token = body?.token?.trim() ?? ''
  const client = await getClientByToken(token)
  if (!client) return json({ error: 'Brak dostępu.' }, 403)
  await setClientCookie(token)
  return json({ ok: true })
}
