import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { storeLibraryImage } from './avatar-storage'
import type { Database } from './db'
import { LIBRARY_EXERCISES, exerciseFileKey, normalizeExerciseName } from './library-names'
import { libraryExercises } from './schema'

const PHOTO_DIR = path.join(process.cwd(), 'public', 'exercises')

async function photoMap() {
  const map = new Map<string, { bytes: Buffer; mime: string }>()
  let names: string[] = []
  try {
    names = await readdir(PHOTO_DIR)
  } catch {
    return map
  }
  for (const name of names) {
    if (!/\.(webp|jpe?g|png|gif)$/i.test(name)) continue
    if (exerciseFileKey(name) === 'placeholder') continue
    const bytes = await readFile(path.join(PHOTO_DIR, name))
    const mime = name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : name.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : name.toLowerCase().endsWith('.gif')
          ? 'image/gif'
          : 'image/jpeg'
    map.set(exerciseFileKey(name), { bytes, mime })
  }
  return map
}

/** Inserts the 15 starter exercises once. A soft-deleted name stays deleted. */
export async function seedExerciseLibrary(db: Database) {
  const photos = await photoMap()
  const rows = await db.select().from(libraryExercises)
  const byName = new Map(rows.map((row) => [row.normalizedName, row]))

  for (let index = 0; index < LIBRARY_EXERCISES.length; index += 1) {
    const name = LIBRARY_EXERCISES[index]!
    const key = normalizeExerciseName(name)
    const photo = photos.get(key)
    const existing = byName.get(key)
    if (existing) {
      if (!existing.deletedAt && !existing.imageData && !existing.imagePath && photo) {
        const stored = await storeLibraryImage(existing.id, photo.bytes, photo.mime)
        await db.update(libraryExercises).set(stored).where(eq(libraryExercises.id, existing.id))
      }
      continue
    }
    const id = crypto.randomUUID()
    const stored = photo
      ? await storeLibraryImage(id, photo.bytes, photo.mime)
      : { imageData: null, imageMime: null, imagePath: null }
    await db.insert(libraryExercises).values({
      id,
      name,
      normalizedName: key,
      position: index,
      imageData: stored.imageData,
      imageMime: stored.imageMime,
      imagePath: stored.imagePath,
    })
  }
}
