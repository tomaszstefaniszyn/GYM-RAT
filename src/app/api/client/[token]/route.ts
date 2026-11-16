import { getClientHome } from '@/lib/data'
import { json } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const home = await getClientHome(token)
  if (!home) return json({ error: 'Nie znaleziono planu.' }, 404)
  return json(home)
}
