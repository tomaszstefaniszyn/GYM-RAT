import { asc, eq, isNull, max } from 'drizzle-orm'
import type { Database } from './db'
import { blocks, exercises } from './schema'

/**
 * Moves legacy flat exercise rows (grouped only by the BLOK text column)
 * into real blocks. Safe to run on every startup: rows that already have
 * block_id are left untouched, including their done state and text.
 */
export async function migrateLegacyBlocks(db: Database) {
  const orphans = await db
    .select({
      id: exercises.id,
      workoutId: exercises.workoutId,
      position: exercises.position,
      blok: exercises.blok,
    })
    .from(exercises)
    .where(isNull(exercises.blockId))
    .orderBy(asc(exercises.position))
  if (orphans.length === 0) return

  const byWorkout = new Map<string, typeof orphans>()
  for (const row of orphans) {
    const list = byWorkout.get(row.workoutId) ?? []
    list.push(row)
    byWorkout.set(row.workoutId, list)
  }

  for (const [workoutId, rows] of byWorkout) {
    const ordered = [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    const groupOrder: string[] = []
    const groups = new Map<string, typeof ordered>()
    for (const row of ordered) {
      const name = row.blok.trim() || 'Blok'
      if (!groups.has(name)) {
        groups.set(name, [])
        groupOrder.push(name)
      }
      groups.get(name)!.push(row)
    }

    const [maxRow] = await db.select({ value: max(blocks.position) }).from(blocks).where(eq(blocks.workoutId, workoutId))
    let position = (maxRow?.value ?? -1) + 1
    for (const name of groupOrder) {
      const blockId = crypto.randomUUID()
      await db.insert(blocks).values({ id: blockId, workoutId, name, position })
      position += 1
      let exercisePosition = 0
      for (const row of groups.get(name)!) {
        await db
          .update(exercises)
          .set({ blockId, position: exercisePosition })
          .where(eq(exercises.id, row.id))
        exercisePosition += 1
      }
    }
  }
}
