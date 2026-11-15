import { getClientTokenFromCookie } from '@/lib/auth'
import { getClientHome } from '@/lib/data'
import { json } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const token = await getClientTokenFromCookie()
  if (!token) return json({ error: 'Brak sesji.' }, 401)
  const home = await getClientHome(token)
  if (!home) return json({ error: 'Brak sesji.' }, 401)
  return json(home)
}
