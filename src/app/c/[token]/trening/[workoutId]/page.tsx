import { notFound } from 'next/navigation'
import { WorkoutScreen } from '@/components/workout-screen'
import { getWorkoutForToken } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ClientWorkoutPage({
  params,
}: {
  params: Promise<{ token: string; workoutId: string }>
}) {
  const { token, workoutId } = await params
  const workout = await getWorkoutForToken(token, workoutId)
  if (!workout) notFound()
  return (
    <main className="shell">
      <WorkoutScreen
        mode="client"
        initial={workout}
        reloadUrl={`/api/client/${token}/workouts/${workout.id}`}
        backHref={`/c/${token}`}
        toggleBase={`/api/client/${token}/exercises`}
        imageBase={`/api/client/${token}/exercises`}
      />
    </main>
  )
}
