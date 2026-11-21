import { LIBRARY_EXERCISES, normalizeExerciseName, seedExercisePhotoUrl } from './library-names'
import { schemaSql } from './schema'

/** Bump when schemaSql or the library seed changes. A matching row skips migration. */
export const SCHEMA_VERSION = 4

export const MIGRATION_LOCK = 847221904

export function schemaStatements() {
  return schemaSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

export function isMissingRelation(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === '42P01') return true
  const message = (error as { message?: string }).message ?? ''
  return /does not exist|nie istnieje/i.test(message) && /schema_version|relation/i.test(message)
}

export type SqlRow = Record<string, unknown>

export type Migrator = {
  unsafe(sql: string, params?: unknown[]): Promise<SqlRow[]>
}

export async function migrateSchema(db: Migrator) {
  for (const statement of schemaStatements()) {
    try {
      await db.unsafe(statement)
    } catch (error) {
      console.error('[gym-rat] migracja SQL', statement.slice(0, 220), error)
      throw error
    }
  }

  const columns = await db.unsafe(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'reps'`,
  )
  const dataType = String(columns[0]?.data_type ?? '')
  if (dataType && dataType !== 'text' && dataType !== 'character varying') {
    await db.unsafe('ALTER TABLE exercises ALTER COLUMN reps DROP DEFAULT')
    await db.unsafe('ALTER TABLE exercises ALTER COLUMN reps TYPE text USING reps::text')
    await db.unsafe(`ALTER TABLE exercises ALTER COLUMN reps SET DEFAULT ''`)
    await db.unsafe('ALTER TABLE exercises ALTER COLUMN reps SET NOT NULL')
  }

  for (let index = 0; index < LIBRARY_EXERCISES.length; index += 1) {
    const name = LIBRARY_EXERCISES[index]!.name
    const key = normalizeExerciseName(name)
    const url = seedExercisePhotoUrl(name)
    await db.unsafe(
      `INSERT INTO library_exercises (id, name, normalized_name, image_path, position)
       SELECT gen_random_uuid(), $1, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM library_exercises WHERE normalized_name = $2)`,
      [name, key, url, index],
    )
    await db.unsafe(
      `UPDATE library_exercises
       SET image_path = $2
       WHERE normalized_name = $1
         AND deleted_at IS NULL
         AND (image_path IS NULL OR image_path LIKE 'library/%')`,
      [key, url],
    )
  }
}
