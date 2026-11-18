import { forbidden, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: Request) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  return forbidden()
}
