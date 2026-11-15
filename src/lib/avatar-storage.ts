import 'server-only'
import { supabaseStorageConfig } from './config'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

export function sniffMime(bytes: Buffer, fallback: string) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (bytes.length >= 6 && (bytes.toString('ascii', 0, 6) === 'GIF87a' || bytes.toString('ascii', 0, 6) === 'GIF89a')) {
    return 'image/gif'
  }
  return fallback
}

export function isAllowedImage(mime: string) {
  return ALLOWED.has(mime.toLowerCase())
}

function extension(mime: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('heif')) return 'heif'
  return 'jpg'
}

export async function storeAvatar(clientId: string, bytes: Buffer, mime: string) {
  const cfg = supabaseStorageConfig()
  if (!cfg) {
    return { avatarData: bytes.toString('base64'), avatarMime: mime, avatarPath: null as string | null }
  }
  const path = `clients/${clientId}.${extension(mime)}`
  const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: new Uint8Array(bytes),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Supabase Storage: ${res.status} ${detail.slice(0, 300)}`)
  }
  return { avatarData: null as string | null, avatarMime: mime, avatarPath: path }
}

export async function readStoredAvatar(client: {
  avatarData: string | null
  avatarMime: string | null
  avatarPath: string | null
}) {
  if (client.avatarPath) {
    const cfg = supabaseStorageConfig()
    if (!cfg) return null
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${client.avatarPath}`, {
      headers: { Authorization: `Bearer ${cfg.key}` },
    })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    return { bytes, mime: client.avatarMime || res.headers.get('content-type') || 'image/jpeg' }
  }
  if (client.avatarData) {
    return { bytes: Buffer.from(client.avatarData, 'base64'), mime: client.avatarMime || 'image/jpeg' }
  }
  return null
}

export async function deleteStoredAvatar(avatarPath: string | null) {
  if (!avatarPath) return
  const cfg = supabaseStorageConfig()
  if (!cfg) return
  await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${avatarPath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.key}` },
  }).catch(() => undefined)
}
