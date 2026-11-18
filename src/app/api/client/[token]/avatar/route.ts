import { readStoredAvatar } from '@/lib/avatar-storage'
import { clearClientAvatar, getClientByToken, saveClientAvatarBytes } from '@/lib/data'
import { json, rejectCrossSite } from '@/lib/http'
import { fileResponse, readFormImage } from '@/lib/image-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const client = await getClientByToken(token)
  if (!client) return json({ error: 'Nie znaleziono planu.' }, 404)
  const file = await readStoredAvatar(client)
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return fileResponse(file)
}

export async function POST(req: Request, ctx: Ctx) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { token } = await ctx.params
  const client = await getClientByToken(token)
  if (!client) return json({ error: 'Nie znaleziono planu.' }, 404)
  const incoming = await readFormImage(req)
  if (incoming instanceof Response) return incoming
  try {
    const updated = await saveClientAvatarBytes(client.id, incoming.bytes, incoming.mime)
    if (!updated) return json({ error: 'Nie znaleziono planu.' }, 404)
    return json({ ok: true, updatedAt: updated.updatedAt.toISOString() })
  } catch (error) {
    console.error('[gym-rat] avatar klienta', error)
    return json({ error: 'Nie udało się zapisać zdjęcia.' }, 500)
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { token } = await ctx.params
  const client = await getClientByToken(token)
  if (!client) return json({ error: 'Nie znaleziono planu.' }, 404)
  const updated = await clearClientAvatar(client.id)
  if (!updated) return json({ error: 'Nie znaleziono planu.' }, 404)
  return json({ ok: true, updatedAt: updated.updatedAt.toISOString() })
}
