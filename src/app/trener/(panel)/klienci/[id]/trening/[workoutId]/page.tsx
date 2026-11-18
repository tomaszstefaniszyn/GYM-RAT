import { notFound } from 'next/navigation'
import { WorkoutScreen } from '@/components/workout-screen'
import { getWorkout } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function TrainerWorkoutPage({
  params,
}: {
  params: Promise<{ id: string; workoutId: string }>
}) {
  const { id, workoutId } = await params
  const workout = await getWorkout(workoutId)
  if (!workout || workout.clientId !== id) notFound()
  return (
    <main className="shell has-dock">
      <WorkoutScreen
        mode="trainer"
        initial={workout}
        reloadUrl={`/api/trainer/workouts/${workout.id}`}
        backHref={`/trener/klienci/${id}`}
        saveUrl={`/api/trainer/workouts/${workout.id}`}
        deleteUrl={`/api/trainer/workouts/${workout.id}`}
        toggleBase="/api/trainer/exercises"
        imageBase="/api/trainer/exercises"
      />
    </main>
  )
}
