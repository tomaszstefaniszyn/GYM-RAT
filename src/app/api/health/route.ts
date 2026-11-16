import { getDb } from '@/lib/db'
import { json } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getDb()
    return json({ ok: true })
  } catch (error) {
    console.error('[gym-rat] health', error)
    return json({ ok: false }, 500)
  }
}
