import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { closeDb, getDb } from '../src/lib/db'
import { clients, exercises, workouts } from '../src/lib/schema'

function at(day: string) {
  return new Date(`${day}T12:00:00.000Z`)
}

const people = [
  {
    key: 'alina',
    name: 'Alina',
    email: 'alina@example.com',
    createdAt: at('2025-09-02'),
    position: 0,
    plans: [{ name: 'Trening A', createdAt: at('2025-10-30'), position: 0, rows: simple('Przysiad') }],
  },
  {
    key: 'pawel',
    name: 'Paweł',
    email: 'pawel@example.com',
    createdAt: at('2024-10-30'),
    position: 1,
    plans: [{ name: 'Trening A', createdAt: at('2024-10-30'), position: 0, rows: simple('Martwy ciąg') }],
  },
  {
    key: 'maria',
    name: 'Maria',
    email: 'maria@example.com',
    createdAt: at('2025-08-12'),
    position: 2,
    plans: [
      { name: 'Trening A', createdAt: at('2025-10-30'), position: 0, rows: simple('Hip thrust') },
      { name: 'Trening B', createdAt: at('2026-11-11'), position: 1, rows: simple('Wiosłowanie') },
    ],
  },
  {
    key: 'krzysiek',
    name: 'Krzysiek',
    email: 'krzysiek@gmail.com',
    createdAt: at('2025-05-20'),
    position: 3,
    plans: [
      {
        name: 'Trening A',
        createdAt: at('2025-10-30'),
        position: 0,
        rows: [
          {
            blok: 'Mobilizacja',
            cwiczenie: 'Deadlift sztanga\nW1: 35kg\nW2:37,5kg\nW3:40kg\nW4:42,5',
            serie: '3',
            reps: '12',
            done: true,
          },
          {
            blok: 'Mobilizacja',
            cwiczenie:
              'Hand elevated push up\n(Regulując wysokość, na jakiej ustawisz ręce, możesz modyfikować trudność ćwiczenia. Im wyżej się znajdą, tym łatwiej będzie je wykonać, box zacznij od 60cm/50cm)',
            serie: '2',
            reps: '',
            done: true,
          },
          { blok: 'Główne', cwiczenie: 'Mobilizacja', serie: '2', reps: '', done: false },
          { blok: 'Akcesoria', cwiczenie: 'Mobilizacja', serie: '1', reps: '', done: false },
          { blok: '', cwiczenie: '', serie: '', reps: '', done: false },
          { blok: '', cwiczenie: '', serie: '', reps: '', done: false },
        ],
      },
      {
        name: 'Trening B',
        createdAt: at('2025-12-04'),
        position: 1,
        rows: [{ blok: 'Główne', cwiczenie: 'Przysiad goblet', serie: '4', reps: '8', done: false }],
      },
      {
        name: 'W DOMU',
        createdAt: at('2025-10-30'),
        position: 2,
        rows: [{ blok: 'Mobilizacja', cwiczenie: 'Rozciąganie bioder', serie: '2', reps: '40s', done: false }],
      },
    ],
  },
  {
    key: 'zuzia',
    name: 'Zuzia',
    email: 'zuzia@example.com',
    createdAt: at('2025-10-02'),
    position: 4,
    plans: [{ name: 'Trening A', createdAt: at('2025-10-30'), position: 0, rows: simple('Deska') }],
  },
] as const

function simple(name: string) {
  return [{ blok: 'Główne', cwiczenie: name, serie: '3', reps: '10', done: false }]
}

async function main() {
  const url = process.env.DATABASE_URL || ''
  const local = !url || /localhost|127\.0\.0\.1/.test(url)
  if (!local && process.env.ALLOW_SEED !== '1') {
    console.error('To nie wygląda na lokalną bazę. Ustaw ALLOW_SEED=1, jeśli na pewno chcesz nadpisać dane.')
    process.exit(1)
  }

  const db = await getDb()
  await db.delete(clients)

  const links: Record<string, string> = {}
  for (const person of people) {
    const token = randomBytes(32).toString('base64url')
    const id = crypto.randomUUID()
    await db.insert(clients).values({
      id,
      name: person.name,
      email: person.email,
      token,
      position: person.position,
      createdAt: person.createdAt,
      updatedAt: person.createdAt,
    })
    links[person.key] = token
    for (const plan of person.plans) {
      const workoutId = crypto.randomUUID()
      await db.insert(workouts).values({
        id: workoutId,
        clientId: id,
        name: plan.name,
        position: plan.position,
        createdAt: plan.createdAt,
      })
      let index = 0
      for (const row of plan.rows) {
        await db.insert(exercises).values({
          id: crypto.randomUUID(),
          workoutId,
          blok: row.blok,
          cwiczenie: row.cwiczenie,
          serie: row.serie,
          reps: row.reps,
          done: row.done,
          position: index,
          updatedAt: plan.createdAt,
        })
        index += 1
      }
    }
  }

  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const out = Object.fromEntries(Object.entries(links).map(([key, token]) => [key, `${base}/c/${token}`]))
  mkdirSync('data', { recursive: true })
  writeFileSync('data/demo-links.json', JSON.stringify(out, null, 2))
  console.log('[gym-rat] Dane demo zapisane. Link Krzyśka:')
  console.log(out.krzysiek)
  await closeDb()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
