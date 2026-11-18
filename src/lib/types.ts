import type { PassStatus, PassTypeId } from './pass'

export type WorkoutPreview = {
  id: string
  name: string
  createdAt: string
}

export type ClientListItem = {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
  hasAvatar: boolean
  workouts: WorkoutPreview[]
}

export type ProfileDTO = {
  id: string
  name: string
  email: string
  hasAvatar: boolean
  updatedAt: string
  birthDate: string | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
  level: string | null
  passType: PassTypeId | null
  trainingStart: string | null
  pass: PassStatus
  passUsed: boolean[]
  goal: string
  injuries: string
}

export type ExerciseDTO = {
  id: string
  cwiczenie: string
  serie: string
  reps: string
  opis: string
  done: boolean
  position: number
  hasImage: boolean
  updatedAt: string
}

export type BlockDTO = {
  id: string
  name: string
  position: number
  exercises: ExerciseDTO[]
}

export type WorkoutDTO = {
  id: string
  name: string
  clientId: string
  clientName: string
  blocks: BlockDTO[]
}

export type ClientHomeDTO = {
  name: string
  workouts: { id: string; name: string }[]
}
