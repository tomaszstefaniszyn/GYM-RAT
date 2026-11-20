import { readStoredAvatar } from '@/lib/avatar-storage'
import { clearClientAvatar, getClientRow, saveClientAvatarBytes } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'
import { fileResponse, readFormImage } from '@/lib/image-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const client = await getClientRow(id, { migrate: false })
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)
  const file = await readStoredAvatar(client)
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return fileResponse(file, _req)
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const incoming = await readFormImage(req)
  if (incoming instanceof Response) return incoming
  try {
    const updated = await saveClientAvatarBytes(id, incoming.bytes, incoming.mime)
    if (!updated) return json({ error: 'Nie znaleziono klienta.' }, 404)
    return json({ ok: true, updatedAt: updated.updatedAt.toISOString() })
  } catch (error) {
    console.error('[gym-rat] avatar', error)
    return json({ error: 'Nie udało się zapisać zdjęcia.' }, 500)
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const updated = await clearClientAvatar(id)
  if (!updated) return json({ error: 'Nie znaleziono klienta.' }, 404)
  return json({ ok: true, updatedAt: updated.updatedAt.toISOString() })
}
