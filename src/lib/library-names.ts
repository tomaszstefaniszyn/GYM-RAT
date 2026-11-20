/** Canonical library, in display order. "Toe Touch Crunch" appears once. */
export const LIBRARY_EXERCISES = [
  'Face Pull - power band with external rotation',
  'Banded Wall Shoulder Flexion',
  'Assisted Pull-Up',
  'Sumo Deadlift Barbell',
  'Glute Bridge Barbell',
  'Ball Hamstring Curl',
  'Rainbow Slam',
  'Toe Touch Crunch',
  'Hip Airplane',
  'Back Squat Barbell',
  'Bench Press Barbell',
  'Seated Dumbbell Curl',
  'Walking Lunges',
  'Kettlebell Swing',
  'Hanging Knees to Chest',
] as const

/** Match photos and names ignoring extension, case and extra spaces. */
export function normalizeExerciseName(value: string) {
  return value.normalize('NFKC').replace(/[\s\u00a0]+/g, ' ').trim().toLowerCase()
}

export function exerciseFileKey(filename: string) {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
  return normalizeExerciseName(base)
}

/** Public URL for a seeded photo. Null when the name is not one of the 15 starters. */
export function seedExercisePhotoUrl(name: string): string | null {
  const key = normalizeExerciseName(name)
  const canonical = LIBRARY_EXERCISES.find((item) => normalizeExerciseName(item) === key)
  if (!canonical) return null
  return `/exercises/${encodeURIComponent(`${canonical}.webp`)}`
}
