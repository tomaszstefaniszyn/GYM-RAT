import 'server-only'
import { getTrainerSession } from './auth'
import { json } from './http'

export async function trainerGuard() {
  const session = await getTrainerSession()
  if (!session) return json({ error: 'Wymagane logowanie.' }, 401)
  return session
}
