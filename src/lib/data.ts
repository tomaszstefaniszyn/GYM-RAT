import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { asc, eq, max } from 'drizzle-orm'
import { deleteStoredAvatar } from './avatar-storage'
import { getDb } from './db'
import { clients, exercises, workouts } from './schema'
import type { ClientHomeDTO, ClientListItem, ExerciseDTO, WorkoutDTO } from './types'

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

function mapExercise(row: typeof exercises.$inferSelect): ExerciseDTO {
  return {
    id: row.id,
    blok: row.blok,
    cwiczenie: row.cwiczenie,
    serie: row.serie,
    reps: row.reps,
    done: Boolean(row.done),
    position: row.position,
    updatedAt: iso(row.updatedAt),
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
  avatar: { avatarData: string | null; avatarMime: string; avatarPath: string | null },
) {
  const db = await getDb()
  const [row] = await db
    .update(clients)
    .set({ ...avatar, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning()
  return row ?? null
}

export async function deleteClient(id: string) {
  const existing = await getClientRow(id)
  if (!existing) return false
  await deleteStoredAvatar(existing.avatarPath)
  const db = await getDb()
  await db.delete(clients).where(eq(clients.id, id))
  return true
}

export async function createWorkout(clientId: string, name: string) {
  const db = await getDb()
  const [maxRow] = await db.select({ value: max(workouts.position) }).from(workouts).where(eq(workouts.clientId, clientId))
  const [row] = await db
    .insert(workouts)
    .values({
      id: crypto.randomUUID(),
      clientId,
      name: name.trim(),
      position: (maxRow?.value ?? -1) + 1,
    })
    .returning()
  return row!
}

export async function deleteWorkout(id: string) {
  const db = await getDb()
  const [row] = await db.delete(workouts).where(eq(workouts.id, id)).returning()
  return row ?? null
}

async function exercisesFor(workoutId: string) {
  const db = await getDb()
  return db.select().from(exercises).where(eq(exercises.workoutId, workoutId)).orderBy(asc(exercises.position))
}

export async function getWorkout(id: string): Promise<WorkoutDTO | null> {
  const db = await getDb()
  const [plan] = await db.select().from(workouts).where(eq(workouts.id, id))
  if (!plan) return null
  const [person] = await db.select().from(clients).where(eq(clients.id, plan.clientId))
  if (!person) return null
  const rows = await exercisesFor(id)
  return {
    id: plan.id,
    name: plan.name,
    clientId: person.id,
    clientName: person.name,
    exercises: rows.map(mapExercise),
  }
}

export async function createExercise(workoutId: string) {
  const db = await getDb()
  const [maxRow] = await db.select({ value: max(exercises.position) }).from(exercises).where(eq(exercises.workoutId, workoutId))
  const [row] = await db
    .insert(exercises)
    .values({
      id: crypto.randomUUID(),
      workoutId,
      position: (maxRow?.value ?? -1) + 1,
    })
    .returning()
  return mapExercise(row!)
}

export type ExercisePatch = Partial<{
  blok: string
  cwiczenie: string
  serie: string
  reps: string
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
  return row ?? null
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
