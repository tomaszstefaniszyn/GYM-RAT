import 'server-only'
import { isAllowedImage, sniffMime } from './avatar-storage'
import { json } from './http'

export const MAX_IMAGE_BYTES = 2_500_000

export function decodeDataImage(image: unknown) {
  if (image === undefined) return undefined
  if (image === null) return null
  if (!image || typeof image !== 'object') return false as const
  const data = (image as { data?: unknown }).data
  const declared = (image as { mime?: unknown }).mime
  if (typeof data !== 'string' || data.length > MAX_IMAGE_BYTES * 2) return false as const
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return false as const
  const mime = sniffMime(bytes, typeof declared === 'string' ? declared : 'application/octet-stream')
  if (!isAllowedImage(mime)) return false as const
  return { bytes, mime }
}

export async function readFormImage(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob)) return json({ error: 'Wybierz zdjęcie.' }, 400)
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return json({ error: 'Zdjęcie musi mieć mniej niż 5 MB.' }, 400)
  const bytes = Buffer.from(await file.arrayBuffer())
  const declared = 'type' in file && typeof file.type === 'string' ? file.type : 'application/octet-stream'
  const mime = sniffMime(bytes, declared || 'application/octet-stream')
  if (!isAllowedImage(mime)) return json({ error: 'Dozwolone są pliki JPG, PNG, WEBP i GIF.' }, 400)
  return { bytes, mime }
}

export function fileResponse(file: { bytes: Buffer; mime: string }, req?: Request) {
  const version = req ? new URL(req.url).searchParams.get('v') : null
  const headers: Record<string, string> = {
    'Content-Type': file.mime,
    'Cache-Control': version ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
  }
  if (version) headers.ETag = `"${version}"`
  return new Response(new Uint8Array(file.bytes), { headers })
}
