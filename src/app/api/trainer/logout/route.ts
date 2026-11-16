import { clearTrainerSession } from '@/lib/auth'
import { json, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  await clearTrainerSession()
  return json({ ok: true })
}
