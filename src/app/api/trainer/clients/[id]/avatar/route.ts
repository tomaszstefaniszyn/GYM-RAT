import { isAllowedImage, readStoredAvatar, sniffMime, storeAvatar } from '@/lib/avatar-storage'
import { getClientRow, updateClientAvatar } from '@/lib/data'
import { trainerGuard } from '@/lib/guard'
import { json, rejectCrossSite } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const { id } = await ctx.params
  const client = await getClientRow(id)
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)
  const file = await readStoredAvatar(client)
  if (!file) return json({ error: 'Brak zdjęcia.' }, 404)
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mime,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await trainerGuard()
  if (session instanceof Response) return session
  const blocked = rejectCrossSite(req)
  if (blocked) return blocked
  const { id } = await ctx.params
  const client = await getClientRow(id)
  if (!client) return json({ error: 'Nie znaleziono klienta.' }, 404)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob)) return json({ error: 'Wybierz zdjęcie.' }, 400)
  if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: 'Zdjęcie musi mieć mniej niż 5 MB.' }, 400)

  const bytes = Buffer.from(await file.arrayBuffer())
  const declared = 'type' in file && typeof file.type === 'string' ? file.type : 'application/octet-stream'
  const mime = sniffMime(bytes, declared || 'application/octet-stream')
  if (!isAllowedImage(mime)) return json({ error: 'Dozwolone są pliki JPG, PNG, WEBP i GIF.' }, 400)

  try {
    const stored = await storeAvatar(id, bytes, mime)
    const updated = await updateClientAvatar(id, stored)
    return json({ ok: true, updatedAt: updated?.updatedAt.toISOString() ?? new Date().toISOString() })
  } catch (error) {
    console.error('[gym-rat] avatar', error)
    return json({ error: 'Nie udało się zapisać zdjęcia.' }, 500)
  }
}
