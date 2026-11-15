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

export type ExerciseDTO = {
  id: string
  blok: string
  cwiczenie: string
  serie: string
  reps: string
  done: boolean
  position: number
  updatedAt: string
}

export type WorkoutDTO = {
  id: string
  name: string
  clientId: string
  clientName: string
  exercises: ExerciseDTO[]
}

export type ClientHomeDTO = {
  name: string
  workouts: { id: string; name: string }[]
}
