import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { asc, eq, isNull } from 'drizzle-orm'
import { closeDb, getDb } from '../src/lib/db'
import { migrateLegacyBlocks } from '../src/lib/migrate'
import { blocks, clients, exercises, workouts } from '../src/lib/schema'
import { createWorkout } from '../src/lib/data'

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error('FAIL', message)
    process.exit(1)
  }
}

process.env.PGLITE_DIR = mkdtempSync(join(tmpdir(), 'gymrat-migrate-'))
delete process.env.DATABASE_URL

async function main() {
const db = await getDb()
const clientId = crypto.randomUUID()
const workoutId = crypto.randomUUID()
await db.insert(clients).values({
  id: clientId,
  name: 'Migracja',
  email: 'migracja@example.com',
  token: 'a'.repeat(32),
})
await db.insert(workouts).values({ id: workoutId, clientId, name: 'Stary', position: 0 })

const rows = [
  { blok: 'Mobilizacja', cwiczenie: 'A', done: true },
  { blok: 'Główne', cwiczenie: 'B', done: false },
  { blok: 'Mobilizacja', cwiczenie: 'C', done: false },
  { blok: '', cwiczenie: 'D', done: false },
  { blok: '  ', cwiczenie: 'E', done: true },
]
let position = 0
for (const row of rows) {
  await db.insert(exercises).values({
    id: crypto.randomUUID(),
    workoutId,
    blockId: null,
    blok: row.blok,
    cwiczenie: row.cwiczenie,
    done: row.done,
    position,
  })
  position += 1
}

await migrateLegacyBlocks(db)
const grouped = await db.select().from(blocks).where(eq(blocks.workoutId, workoutId)).orderBy(asc(blocks.position))
assert(grouped.map((block) => block.name).join('|') === 'Mobilizacja|Główne|Blok', `nazwy bloków: ${grouped.map((b) => b.name).join('|')}`)

const stored = await db.select().from(exercises).where(eq(exercises.workoutId, workoutId)).orderBy(asc(exercises.position))
const byName = new Map<string, string[]>()
for (const block of grouped) {
  byName.set(
    block.name,
    stored.filter((row) => row.blockId === block.id).sort((a, b) => a.position - b.position).map((row) => `${row.cwiczenie}:${row.done}`),
  )
}
assert(byName.get('Mobilizacja')?.join(',') === 'A:true,C:false', 'kolejność w bloku i odhaczenie')
assert(byName.get('Główne')?.join(',') === 'B:false', 'blok główne')
assert(byName.get('Blok')?.join(',') === 'D:false,E:true', 'pusty BLOK')
assert((await db.select().from(exercises).where(isNull(exercises.blockId))).length === 0, 'brak sierot')

const before = grouped.length
await migrateLegacyBlocks(db)
const again = await db.select().from(blocks).where(eq(blocks.workoutId, workoutId))
assert(again.length === before, 'migracja jest idempotentna')

const created = await createWorkout(clientId)
const freshBlocks = await db.select().from(blocks).where(eq(blocks.workoutId, created.id))
assert(freshBlocks.length === 1 && freshBlocks[0]?.name === 'Rozgrzewka', 'nowy trening ma Rozgrzewkę')
const freshExercises = await db.select().from(exercises).where(eq(exercises.workoutId, created.id))
assert(freshExercises.length === 0, 'nowy blok jest pusty')

await closeDb()
console.log('MIGRATE OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
