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

export async function storeBinary(objectPath: string, bytes: Buffer, mime: string) {
  const cfg = supabaseStorageConfig()
  if (!cfg) {
    return { data: bytes.toString('base64'), mime, path: null as string | null }
  }
  const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${objectPath}`, {
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
  return { data: null as string | null, mime, path: objectPath }
}

export async function storeAvatar(clientId: string, bytes: Buffer, mime: string) {
  const stored = await storeBinary(`clients/${clientId}.${extension(mime)}`, bytes, mime)
  return { avatarData: stored.data, avatarMime: stored.mime, avatarPath: stored.path }
}

export async function storeExerciseImage(exerciseId: string, bytes: Buffer, mime: string) {
  const stored = await storeBinary(`exercises/${exerciseId}.${extension(mime)}`, bytes, mime)
  return { imageData: stored.data, imageMime: stored.mime, imagePath: stored.path }
}

export async function readStoredBinary(file: { data: string | null; mime: string | null; path: string | null }) {
  if (file.path) {
    const cfg = supabaseStorageConfig()
    if (!cfg) return null
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${file.path}`, {
      headers: { Authorization: `Bearer ${cfg.key}` },
    })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    return { bytes, mime: file.mime || res.headers.get('content-type') || 'image/jpeg' }
  }
  if (file.data) return { bytes: Buffer.from(file.data, 'base64'), mime: file.mime || 'image/jpeg' }
  return null
}

export async function readStoredAvatar(client: {
  avatarData: string | null
  avatarMime: string | null
  avatarPath: string | null
}) {
  return readStoredBinary({ data: client.avatarData, mime: client.avatarMime, path: client.avatarPath })
}

export async function readStoredExercise(row: {
  imageData: string | null
  imageMime: string | null
  imagePath: string | null
}) {
  return readStoredBinary({ data: row.imageData, mime: row.imageMime, path: row.imagePath })
}

export async function deleteStoredImage(objectPath: string | null) {
  if (!objectPath) return
  const cfg = supabaseStorageConfig()
  if (!cfg) return
  await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.key}` },
  }).catch(() => undefined)
}

export async function deleteStoredAvatar(avatarPath: string | null) {
  return deleteStoredImage(avatarPath)
}
