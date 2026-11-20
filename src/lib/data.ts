import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm'
import {
  deleteStoredAvatar,
  deleteStoredImage,
  readStoredExercise,
  storeAvatar,
  storeExerciseImage,
  storeLibraryImage,
} from './avatar-storage'
import { getDb, type DbOptions } from './db'
import { normalizeExerciseName, seedExercisePhotoUrl } from './library-names'
import {
  ageYears,
  diffDays,
  normalizePassUsed,
  parseIsoDate,
  passStatus,
  passTypeById,
  summarizePass,
  toIso,
  warsawToday,
  type PassTypeId,
  type ProfileInput,
} from './pass'
import { blocks, clients, exercises, libraryExercises, workouts } from './schema'
import type { ClientHomeDTO, ClientListItem, ExerciseDTO, LibraryExerciseDTO, ProfileDTO, WorkoutDTO } from './types'

function iso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString()
}

function tokenMatches(stored: string, given: string) {
  const actual = Buffer.from(stored)
  const expected = Buffer.from(given)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string; cause?: { code?: string } }
  return candidate.code === '23505' || candidate.cause?.code === '23505' || /unique/i.test(candidate.message ?? '')
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function calendarDate(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) {
    return toIso({ y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() })
  }
  return String(value).slice(0, 10)
}

function asUsed(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return []
    }
  }
  return value
}

function mapExercise(row: typeof exercises.$inferSelect): ExerciseDTO {
  return {
    id: row.id,
    cwiczenie: row.cwiczenie,
    serie: row.serie,
    reps: row.reps,
    opis: row.opis ?? '',
    done: Boolean(row.done),
    position: row.position,
    hasImage: Boolean(row.imageData || row.imagePath),
    updatedAt: iso(row.updatedAt),
  }
}

function mapProfile(row: typeof clients.$inferSelect): ProfileDTO {
  const today = warsawToday()
  const birth = parseIsoDate(calendarDate(row.birthDate))
  const start = parseIsoDate(calendarDate(row.trainingStart))
  const passType = (passTypeById(row.passType)?.id ?? null) as PassTypeId | null
  const age = birth && diffDays(today, birth) <= 0 ? ageYears(birth, today) : null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hasAvatar: Boolean(row.avatarData || row.avatarPath),
    updatedAt: iso(row.updatedAt),
    birthDate: birth ? toIso(birth) : null,
    age: age !== null && age >= 0 ? age : null,
    weightKg: asNumber(row.weightKg),
    heightCm: asNumber(row.heightCm),
    level: row.level,
    passType,
    trainingStart: start ? toIso(start) : null,
    pass: passStatus(passType, start, today),
    passSummary: summarizePass(passType, start, asUsed(row.passUsed), today),
    passUsed: normalizePassUsed(passType, asUsed(row.passUsed)),
    goal: row.goal ?? '',
    injuries: row.injuries ?? '',
  }
}

function shownPlanDate(workout: typeof workouts.$inferSelect) {
  if (workout.planDate) return workout.planDate.slice(0, 10)
  return toIso(warsawToday(workout.createdAt))
}

function mapClient(row: typeof clients.$inferSelect, clientWorkouts: (typeof workouts.$inferSelect)[]): ClientListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    hasAvatar: Boolean(row.avatarData || row.avatarPath),
    passSummary: summarizePass(
      (passTypeById(row.passType)?.id ?? null) as PassTypeId | null,
      parseIsoDate(calendarDate(row.trainingStart)),
      asUsed(row.passUsed),
    ),
    workouts: clientWorkouts.map((workout) => ({
      id: workout.id,
      name: workout.name,
      createdAt: iso(workout.createdAt),
      date: shownPlanDate(workout),
    })),
  }
}

function nextWorkoutName(names: string[]) {
  const taken = new Set(names.map((name) => name.trim().toLowerCase()))
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const letter of letters) {
    const name = `Trening ${letter}`
    if (!taken.has(name.toLowerCase())) return name
  }
  let index = names.length + 1
  while (taken.has(`trening ${index}`)) index += 1
  return `Trening ${index}`
}

export async function listClients(): Promise<ClientListItem[]> {
  const db = await getDb()
  const [people, plans] = await Promise.all([
    db.select().from(clients).where(isNull(clients.removedAt)).orderBy(asc(clients.position), asc(clients.createdAt)),
    db.select().from(workouts).orderBy(asc(workouts.position), asc(workouts.createdAt)),
  ])
  return people.map((person) => mapClient(person, plans.filter((plan) => plan.clientId === person.id)))
}

export async function getClientDetail(id: string) {
  const db = await getDb()
  const [[person], plans] = await Promise.all([
    db.select().from(clients).where(and(eq(clients.id, id), isNull(clients.removedAt))),
    db
      .select()
      .from(workouts)
      .where(eq(workouts.clientId, id))
      .orderBy(asc(workouts.position), asc(workouts.createdAt)),
  ])
  if (!person) return null
  return mapClient(person, plans)
}

export async function getClientRow(id: string, options?: DbOptions) {
  const db = await getDb(options)
  const [person] = await db.select().from(clients).where(eq(clients.id, id))
  return person ?? null
}

export async function getProfile(id: string) {
  const row = await getClientRow(id)
  return row ? mapProfile(row) : null
}

export async function getProfileByToken(token: string) {
  const row = await getClientByToken(token)
  return row ? mapProfile(row) : null
}

export async function updateProfile(id: string, input: ProfileInput) {
  const db = await getDb()
  const [row] = await db
    .update(clients)
    .set({
      name: input.name,
      birthDate: input.birthDate,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      level: input.level,
      passType: input.passType,
      trainingStart: input.trainingStart,
      passUsed: input.passUsed,
      goal: input.goal,
      injuries: input.injuries,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning()
  return row ? mapProfile(row) : null
}

export async function createClient(input: { name: string; email: string }) {
  const db = await getDb()
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const [existing] = await db.select().from(clients).where(eq(clients.email, email))
  if (existing && !existing.removedAt) return { error: 'Ten e-mail jest już na liście.' as const }
  if (existing?.removedAt) {
    const [row] = await db
      .update(clients)
      .set({
        name,
        token: randomBytes(32).toString('base64url'),
        removedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, existing.id))
      .returning()
    return { client: row! }
  }
  const [maxRow] = await db.select({ value: max(clients.position) }).from(clients)
  try {
    const [row] = await db
      .insert(clients)
      .values({
        id: crypto.randomUUID(),
        name,
        email,
        token: randomBytes(32).toString('base64url'),
        position: (maxRow?.value ?? -1) + 1,
      })
      .returning()
    return { client: row! }
  } catch (error) {
    if (isUniqueViolation(error)) return { error: 'Ten e-mail jest już na liście.' as const }
    throw error
  }
}

export async function updateClientAvatar(
  id: string,
  avatar: { avatarData: string | null; avatarMime: string | null; avatarPath: string | null },
) {
  const db = await getDb()
  const [row] = await db
    .update(clients)
    .set({ ...avatar, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning()
  return row ?? null
}

export async function saveClientAvatarBytes(id: string, bytes: Buffer, mime: string) {
  const existing = await getClientRow(id)
  if (!existing) return null
  const stored = await storeAvatar(id, bytes, mime)
  const updated = await updateClientAvatar(id, stored)
  if (existing.avatarPath && existing.avatarPath !== stored.avatarPath) await deleteStoredAvatar(existing.avatarPath)
  return updated
}

export async function clearClientAvatar(id: string) {
  const existing = await getClientRow(id)
  if (!existing) return null
  await deleteStoredAvatar(existing.avatarPath)
  return updateClientAvatar(id, { avatarData: null, avatarMime: null, avatarPath: null })
}

export async function updateWorkoutPlanDate(id: string, planDate: string) {
  const parsed = parseIsoDate(planDate)
  if (!parsed) return { error: 'Podaj datę w formacie DD.MM.RRRR.' as const }
  const db = await getDb()
  const [row] = await db
    .update(workouts)
    .set({ planDate: toIso(parsed) })
    .where(eq(workouts.id, id))
    .returning()
  if (!row) return { error: 'Nie znaleziono treningu.' as const }
  return { date: shownPlanDate(row) }
}

/**
 * Hides the client and revokes access. History stays.
 * The previous token stops matching, so the link and the session cookie die.
 */
export async function archiveClient(id: string) {
  const db = await getDb()
  const [row] = await db
    .update(clients)
    .set({
      removedAt: new Date(),
      token: randomBytes(32).toString('base64url'),
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, id), isNull(clients.removedAt)))
    .returning()
  return Boolean(row)
}

export async function deleteClient(id: string) {
  const existing = await getClientRow(id)
  if (!existing) return false
  const db = await getDb()
  const plans = await db.select({ id: workouts.id }).from(workouts).where(eq(workouts.clientId, id))
  const planIds = plans.map((plan) => plan.id)
  const images = planIds.length
    ? await db.select({ imagePath: exercises.imagePath }).from(exercises).where(inArray(exercises.workoutId, planIds))
    : []
  await db.delete(clients).where(eq(clients.id, id))
  await deleteStoredAvatar(existing.avatarPath)
  for (const image of images) await deleteStoredImage(image.imagePath)
  return true
}

export async function createWorkout(clientId: string, name?: string) {
  const db = await getDb()
  const [existing, [maxRow]] = await Promise.all([
    db.select().from(workouts).where(eq(workouts.clientId, clientId)),
    db.select({ value: max(workouts.position) }).from(workouts).where(eq(workouts.clientId, clientId)),
  ])
  const workoutName = (name?.trim() || nextWorkoutName(existing.map((plan) => plan.name))).slice(0, 80)
  const id = crypto.randomUUID()
  const blockId = crypto.randomUUID()
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workouts)
      .values({
        id,
        clientId,
        name: workoutName,
        position: (maxRow?.value ?? -1) + 1,
        planDate: toIso(warsawToday()),
      })
      .returning()
    await tx.insert(blocks).values({ id: blockId, workoutId: id, name: 'Rozgrzewka', position: 0 })
    return row!
  })
  return { id: created.id, name: created.name, createdAt: created.createdAt }
}

export async function deleteWorkout(id: string) {
  const db = await getDb()
  const images = await db.select({ imagePath: exercises.imagePath }).from(exercises).where(eq(exercises.workoutId, id))
  const [row] = await db.delete(workouts).where(eq(workouts.id, id)).returning()
  if (!row) return null
  for (const image of images) await deleteStoredImage(image.imagePath)
  return row
}

export async function getWorkout(id: string): Promise<WorkoutDTO | null> {
  const db = await getDb()
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, id))
  if (!plan) return null
  const [[person], blockRows, exerciseRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, plan.clientId)),
    db.select().from(blocks).where(eq(blocks.workoutId, id)).orderBy(asc(blocks.position)),
    db.select().from(exercises).where(eq(exercises.workoutId, id)).orderBy(asc(exercises.position)),
  ])
  if (!person) return null
  return {
    id: plan.id,
    name: plan.name,
    clientId: person.id,
    clientName: person.name,
    blocks: blockRows.map((block) => ({
      id: block.id,
      name: block.name,
      position: block.position,
      exercises: exerciseRows.filter((row) => row.blockId === block.id).map(mapExercise),
    })),
  }
}

export async function createExercise(workoutId: string, blockId?: string) {
  const db = await getDb()
  let target = blockId ?? null
  if (target) {
    const [block] = await db.select().from(blocks).where(eq(blocks.id, target))
    if (!block || block.workoutId !== workoutId) return null
  } else {
    const existing = await db.select().from(blocks).where(eq(blocks.workoutId, workoutId)).orderBy(asc(blocks.position))
    if (existing[0]) {
      target = existing[0].id
    } else {
      target = crypto.randomUUID()
      await db.insert(blocks).values({ id: target, workoutId, name: 'Rozgrzewka', position: 0 })
    }
  }
  const [maxRow] = await db.select({ value: max(exercises.position) }).from(exercises).where(eq(exercises.blockId, target))
  const [row] = await db
    .insert(exercises)
    .values({
      id: crypto.randomUUID(),
      workoutId,
      blockId: target,
      position: (maxRow?.value ?? -1) + 1,
    })
    .returning()
  return mapExercise(row!)
}

export type ExercisePatch = Partial<{
  cwiczenie: string
  serie: string
  reps: string
  opis: string
  done: boolean
}>

export async function updateExercise(id: string, patch: ExercisePatch) {
  const db = await getDb()
  const [row] = await db
    .update(exercises)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(exercises.id, id))
    .returning()
  return row ? mapExercise(row) : null
}

export async function deleteExercise(id: string) {
  const db = await getDb()
  const [row] = await db.delete(exercises).where(eq(exercises.id, id)).returning()
  if (!row) return null
  await deleteStoredImage(row.imagePath)
  return row
}

export async function getExerciseRow(id: string, options?: DbOptions) {
  const db = await getDb(options)
  const [row] = await db.select().from(exercises).where(eq(exercises.id, id))
  return row ?? null
}

export type PlanImage = { bytes: Buffer; mime: string }

export type PlanSaveInput = {
  name: string
  blocks: Array<{
    id?: string
    name: string
    exercises: Array<{
      id?: string
      cwiczenie: string
      serie: string
      reps: string
      opis: string
      done?: boolean
      image?: PlanImage | null
    }>
  }>
}

export async function saveWorkoutPlan(workoutId: string, input: PlanSaveInput): Promise<WorkoutDTO | { error: string }> {
  if (input.blocks.length > 40) return { error: 'Za dużo bloków.' }
  const exerciseCount = input.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
  if (exerciseCount > 200) return { error: 'Za dużo ćwiczeń.' }
  for (const block of input.blocks) {
    if (block.exercises.length > 60) return { error: 'Za dużo ćwiczeń w bloku.' }
  }

  const db = await getDb()
  const [[plan], existingBlocks, existingExercises] = await Promise.all([
    db.select().from(workouts).where(eq(workouts.id, workoutId)),
    db.select().from(blocks).where(eq(blocks.workoutId, workoutId)),
    db.select().from(exercises).where(eq(exercises.workoutId, workoutId)),
  ])
  if (!plan) return { error: 'Nie znaleziono treningu.' }
  const blockIds = new Set(existingBlocks.map((block) => block.id))
  const exerciseById = new Map(existingExercises.map((row) => [row.id, row]))
  const seenBlockIds = new Set<string>()
  const seenExerciseIds = new Set<string>()

  for (const block of input.blocks) {
    if (block.id) {
      if (!blockIds.has(block.id)) return { error: 'Nie znaleziono bloku.' }
      if (seenBlockIds.has(block.id)) return { error: 'Powtórzony blok.' }
      seenBlockIds.add(block.id)
    }
    for (const exercise of block.exercises) {
      if (!exercise.id) continue
      const row = exerciseById.get(exercise.id)
      if (!row) return { error: 'Nie znaleziono ćwiczenia.' }
      if (seenExerciseIds.has(exercise.id)) return { error: 'Powtórzone ćwiczenie.' }
      seenExerciseIds.add(exercise.id)
    }
  }

  const pathsToDelete: string[] = []
  const removed = existingExercises.filter((row) => !seenExerciseIds.has(row.id))
  for (const row of removed) {
    if (row.imagePath) pathsToDelete.push(row.imagePath)
  }

  try {
    await db.transaction(async (tx) => {
      const name = input.name.trim().slice(0, 80) || plan.name
      await tx.update(workouts).set({ name }).where(eq(workouts.id, workoutId))

      for (let blockIndex = 0; blockIndex < input.blocks.length; blockIndex += 1) {
        const block = input.blocks[blockIndex]!
        const blockName = block.name.trim().slice(0, 80) || 'Blok'
        let blockId = block.id
        if (blockId) {
          await tx.update(blocks).set({ name: blockName, position: blockIndex }).where(eq(blocks.id, blockId))
        } else {
          blockId = crypto.randomUUID()
          await tx.insert(blocks).values({ id: blockId, workoutId, name: blockName, position: blockIndex })
        }

        for (let exerciseIndex = 0; exerciseIndex < block.exercises.length; exerciseIndex += 1) {
          const exercise = block.exercises[exerciseIndex]!
          const fields = {
            blockId,
            cwiczenie: exercise.cwiczenie.slice(0, 4000),
            serie: exercise.serie.slice(0, 40),
            reps: exercise.reps.slice(0, 80),
            opis: exercise.opis.slice(0, 4000),
            position: exerciseIndex,
            updatedAt: new Date(),
          }
          let exerciseId = exercise.id
          if (exerciseId) {
            await tx.update(exercises).set(fields).where(eq(exercises.id, exerciseId))
          } else {
            exerciseId = crypto.randomUUID()
            await tx.insert(exercises).values({
              id: exerciseId,
              workoutId,
              blok: '',
              done: exercise.done === true,
              ...fields,
            })
          }
          if (exercise.image !== undefined) {
            const current = exerciseById.get(exercise.id ?? '')
            if (exercise.image === null) {
              if (current?.imagePath) pathsToDelete.push(current.imagePath)
              await tx
                .update(exercises)
                .set({ imageData: null, imageMime: null, imagePath: null })
                .where(eq(exercises.id, exerciseId))
            } else {
              const stored = await storeExerciseImage(exerciseId, exercise.image.bytes, exercise.image.mime)
              if (current?.imagePath && current.imagePath !== stored.imagePath) pathsToDelete.push(current.imagePath)
              await tx
                .update(exercises)
                .set({
                  imageData: stored.imageData,
                  imageMime: stored.imageMime,
                  imagePath: stored.imagePath,
                })
                .where(eq(exercises.id, exerciseId))
            }
          }
        }
      }

      if (removed.length > 0) {
        await tx.delete(exercises).where(
          inArray(
            exercises.id,
            removed.map((row) => row.id),
          ),
        )
      }
      const removedBlocks = existingBlocks.filter((block) => !seenBlockIds.has(block.id))
      if (removedBlocks.length > 0) {
        await tx.delete(blocks).where(
          inArray(
            blocks.id,
            removedBlocks.map((block) => block.id),
          ),
        )
      }
    })
  } catch (error) {
    console.error('[gym-rat] zapis planu', error)
    return { error: 'Nie udało się zapisać planu.' }
  }

  for (const objectPath of pathsToDelete) await deleteStoredImage(objectPath)
  const fresh = await getWorkout(workoutId)
  if (!fresh) return { error: 'Nie udało się zapisać planu.' }
  return fresh
}

export async function getClientByToken(token: string, options?: DbOptions) {
  if (!token || token.length < 20) return null
  const db = await getDb(options)
  const [person] = await db.select().from(clients).where(eq(clients.token, token))
  if (!person || person.removedAt || !tokenMatches(person.token, token)) return null
  return person
}

export async function getClientHome(token: string): Promise<ClientHomeDTO | null> {
  if (!token || token.length < 20) return null
  const db = await getDb()
  const rows = await db
    .select({
      client: clients,
      workoutId: workouts.id,
      workoutName: workouts.name,
    })
    .from(clients)
    .leftJoin(workouts, eq(workouts.clientId, clients.id))
    .where(eq(clients.token, token))
    .orderBy(asc(workouts.position), asc(workouts.createdAt))
  const person = rows[0]?.client
  if (!person || person.removedAt || !tokenMatches(person.token, token)) return null
  const today = warsawToday()
  const passType = (passTypeById(person.passType)?.id ?? null) as PassTypeId | null
  return {
    name: person.name,
    workouts: rows
      .filter((row) => row.workoutId && row.workoutName)
      .map((row) => ({ id: row.workoutId!, name: row.workoutName! })),
    passSummary: summarizePass(passType, parseIsoDate(calendarDate(person.trainingStart)), asUsed(person.passUsed), today),
  }
}

export async function getWorkoutForToken(token: string, workoutId: string) {
  if (!token || token.length < 20) return null
  const db = await getDb()
  const [access] = await db
    .select({ client: clients, plan: workouts })
    .from(clients)
    .innerJoin(workouts, and(eq(workouts.id, workoutId), eq(workouts.clientId, clients.id)))
    .where(eq(clients.token, token))
  if (!access || access.client.removedAt || !tokenMatches(access.client.token, token)) return null
  const [blockRows, exerciseRows] = await Promise.all([
    db.select().from(blocks).where(eq(blocks.workoutId, workoutId)).orderBy(asc(blocks.position)),
    db.select().from(exercises).where(eq(exercises.workoutId, workoutId)).orderBy(asc(exercises.position)),
  ])
  return {
    id: access.plan.id,
    name: access.plan.name,
    clientId: access.client.id,
    clientName: access.client.name,
    blocks: blockRows.map((block) => ({
      id: block.id,
      name: block.name,
      position: block.position,
      exercises: exerciseRows.filter((row) => row.blockId === block.id).map(mapExercise),
    })),
  }
}

export async function setExerciseDoneForToken(token: string, exerciseId: string, done: boolean) {
  const person = await getClientByToken(token)
  if (!person) return null
  const db = await getDb()
  const [row] = await db
    .select({ exerciseId: exercises.id, clientId: workouts.clientId })
    .from(exercises)
    .innerJoin(workouts, eq(workouts.id, exercises.workoutId))
    .where(eq(exercises.id, exerciseId))
  if (!row || row.clientId !== person.id) return null
  return updateExercise(exerciseId, { done })
}

function libraryImageUrl(row: typeof libraryExercises.$inferSelect) {
  if (row.imagePath?.startsWith('/')) return row.imagePath
  const seed = seedExercisePhotoUrl(row.normalizedName)
  const custom = Boolean(row.imageData || (row.imagePath && !row.imagePath.startsWith('/')))
  if (!custom && seed) return seed
  if (custom) {
    const version = row.createdAt instanceof Date ? row.createdAt.getTime() : '1'
    return `/api/trainer/library/${row.id}/image?v=${version}`
  }
  return seed
}

function mapLibrary(row: typeof libraryExercises.$inferSelect): LibraryExerciseDTO {
  const imageUrl = libraryImageUrl(row)
  return {
    id: row.id,
    name: row.name,
    hasImage: Boolean(imageUrl),
    imageUrl,
    position: row.position,
  }
}

export async function listLibrary() {
  const db = await getDb()
  const rows = await db
    .select()
    .from(libraryExercises)
    .where(isNull(libraryExercises.deletedAt))
    .orderBy(asc(libraryExercises.position), asc(libraryExercises.name))
  return rows.map(mapLibrary)
}

export async function createLibraryExercise(name: string, image?: { bytes: Buffer; mime: string } | null) {
  const trimmed = name.trim().replace(/[\s\u00a0]+/g, ' ')
  if (!trimmed) return { error: 'Podaj nazwę ćwiczenia.' as const }
  if (trimmed.length > 120) return { error: 'Nazwa jest za długa.' as const }
  const normalized = normalizeExerciseName(trimmed)
  const db = await getDb()
  const active = and(eq(libraryExercises.normalizedName, normalized), isNull(libraryExercises.deletedAt))
  const [[existing], [maxRow]] = await Promise.all([
    db.select().from(libraryExercises).where(active),
    db.select({ value: max(libraryExercises.position) }).from(libraryExercises),
  ])
  if (existing) return { exercise: mapLibrary(existing) }

  const id = crypto.randomUUID()
  const stored = image
    ? await storeLibraryImage(id, image.bytes, image.mime)
    : { imageData: null, imageMime: null, imagePath: null }
  try {
    const [row] = await db
      .insert(libraryExercises)
      .values({
        id,
        name: trimmed,
        normalizedName: normalized,
        position: (maxRow?.value ?? -1) + 1,
        imageData: stored.imageData,
        imageMime: stored.imageMime,
        imagePath: stored.imagePath,
      })
      .returning()
    return { exercise: mapLibrary(row!) }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const [row] = await db.select().from(libraryExercises).where(active)
    if (!row) throw error
    return { exercise: mapLibrary(row) }
  }
}

export async function deleteLibraryExercise(id: string) {
  const db = await getDb()
  const [row] = await db
    .update(libraryExercises)
    .set({ deletedAt: new Date() })
    .where(and(eq(libraryExercises.id, id), isNull(libraryExercises.deletedAt)))
    .returning()
  return Boolean(row)
}

export async function getLibraryImage(id: string) {
  const db = await getDb({ migrate: false })
  const [row] = await db
    .select()
    .from(libraryExercises)
    .where(and(eq(libraryExercises.id, id), isNull(libraryExercises.deletedAt)))
  if (!row) return null
  return readStoredExercise(row)
}

export async function getExerciseImageForToken(token: string, exerciseId: string) {
  const person = await getClientByToken(token, { migrate: false })
  if (!person) return null
  const row = await getExerciseRow(exerciseId, { migrate: false })
  if (!row) return null
  const db = await getDb({ migrate: false })
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, row.workoutId))
  if (!plan || plan.clientId !== person.id) return null
  return readStoredExercise(row)
}
