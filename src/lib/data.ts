import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { asc, eq, inArray, max } from 'drizzle-orm'
import {
  deleteStoredAvatar,
  deleteStoredImage,
  readStoredExercise,
  storeAvatar,
  storeExerciseImage,
} from './avatar-storage'
import { getDb } from './db'
import {
  ageYears,
  diffDays,
  normalizePassUsed,
  parseIsoDate,
  passStatus,
  passTypeById,
  toIso,
  warsawToday,
  type PassTypeId,
  type ProfileInput,
} from './pass'
import { blocks, clients, exercises, workouts } from './schema'
import type { ClientHomeDTO, ClientListItem, ExerciseDTO, ProfileDTO, WorkoutDTO } from './types'

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
    passUsed: normalizePassUsed(passType, asUsed(row.passUsed)),
    goal: row.goal ?? '',
    injuries: row.injuries ?? '',
  }
}

function mapClient(row: typeof clients.$inferSelect, clientWorkouts: (typeof workouts.$inferSelect)[]): ClientListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    hasAvatar: Boolean(row.avatarData || row.avatarPath),
    workouts: clientWorkouts.map((workout) => ({
      id: workout.id,
      name: workout.name,
      createdAt: iso(workout.createdAt),
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
  const people = await db.select().from(clients).orderBy(asc(clients.position), asc(clients.createdAt))
  const plans = await db.select().from(workouts).orderBy(asc(workouts.position), asc(workouts.createdAt))
  return people.map((person) => mapClient(person, plans.filter((plan) => plan.clientId === person.id)))
}

export async function getClientDetail(id: string) {
  const db = await getDb()
  const [person] = await db.select().from(clients).where(eq(clients.id, id))
  if (!person) return null
  const plans = await db
    .select()
    .from(workouts)
    .where(eq(workouts.clientId, id))
    .orderBy(asc(workouts.position), asc(workouts.createdAt))
  return mapClient(person, plans)
}

export async function getClientRow(id: string) {
  const db = await getDb()
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
  const existing = await db.select().from(workouts).where(eq(workouts.clientId, clientId))
  const [maxRow] = await db.select({ value: max(workouts.position) }).from(workouts).where(eq(workouts.clientId, clientId))
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
  const [person] = await db.select().from(clients).where(eq(clients.id, plan.clientId))
  if (!person) return null
  const blockRows = await db.select().from(blocks).where(eq(blocks.workoutId, id)).orderBy(asc(blocks.position))
  const exerciseRows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.workoutId, id))
    .orderBy(asc(exercises.position))
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

export async function getExerciseRow(id: string) {
  const db = await getDb()
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
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, workoutId))
  if (!plan) return { error: 'Nie znaleziono treningu.' }

  const existingBlocks = await db.select().from(blocks).where(eq(blocks.workoutId, workoutId))
  const existingExercises = await db.select().from(exercises).where(eq(exercises.workoutId, workoutId))
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
            reps: exercise.reps.slice(0, 40),
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

export async function getClientByToken(token: string) {
  if (!token || token.length < 20) return null
  const db = await getDb()
  const [person] = await db.select().from(clients).where(eq(clients.token, token))
  if (!person || !tokenMatches(person.token, token)) return null
  return person
}

export async function getClientHome(token: string): Promise<ClientHomeDTO | null> {
  const person = await getClientByToken(token)
  if (!person) return null
  const db = await getDb()
  const plans = await db
    .select()
    .from(workouts)
    .where(eq(workouts.clientId, person.id))
    .orderBy(asc(workouts.position), asc(workouts.createdAt))
  return {
    name: person.name,
    workouts: plans.map((plan) => ({ id: plan.id, name: plan.name })),
  }
}

export async function getWorkoutForToken(token: string, workoutId: string) {
  const person = await getClientByToken(token)
  if (!person) return null
  const workout = await getWorkout(workoutId)
  if (!workout || workout.clientId !== person.id) return null
  return workout
}

export async function setExerciseDoneForToken(token: string, exerciseId: string, done: boolean) {
  const person = await getClientByToken(token)
  if (!person) return null
  const db = await getDb()
  const [row] = await db.select().from(exercises).where(eq(exercises.id, exerciseId))
  if (!row) return null
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, row.workoutId))
  if (!plan || plan.clientId !== person.id) return null
  return updateExercise(exerciseId, { done })
}

export async function getExerciseImageForToken(token: string, exerciseId: string) {
  const person = await getClientByToken(token)
  if (!person) return null
  const row = await getExerciseRow(exerciseId)
  if (!row) return null
  const db = await getDb()
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, row.workoutId))
  if (!plan || plan.clientId !== person.id) return null
  return readStoredExercise(row)
}
