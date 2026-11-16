import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { schema, schemaSql } from './schema'

export type Database = PostgresJsDatabase<typeof schema>

type Holder = {
  ready?: Promise<Database>
  close?: () => Promise<void>
  driver?: 'pglite' | 'postgres'
}

const globalForDb = globalThis as typeof globalThis & { __gymrat?: Holder }

function holder(): Holder {
  if (!globalForDb.__gymrat) globalForDb.__gymrat = {}
  return globalForDb.__gymrat
}

export function dbDriver() {
  return holder().driver ?? (process.env.DATABASE_URL ? 'postgres' : 'pglite')
}

async function applySql(run: (statement: string) => Promise<unknown>) {
  const statements = schemaSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
  for (const statement of statements) {
    await run(statement)
  }
}

async function open(): Promise<Database> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    const postgres = (await import('postgres')).default
    const local = /localhost|127\.0\.0\.1/.test(databaseUrl)
    const sql = postgres(databaseUrl, {
      prepare: false,
      max: 3,
      ssl: local ? undefined : 'require',
      idle_timeout: 20,
    })
    await applySql((statement) => sql.unsafe(statement))
    holder().close = async () => {
      await sql.end({ timeout: 5 })
    }
    holder().driver = 'postgres'
    console.info('[gym-rat] Baza: Postgres')
    return drizzlePostgres(sql, { schema })
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL jest wymagany na produkcji. Zobacz README.')
  }

  const { mkdir } = await import('node:fs/promises')
  const path = await import('node:path')
  const dir = path.join(process.cwd(), 'data', 'pglite')
  await mkdir(dir, { recursive: true })
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const client = await PGlite.create(dir)
  await applySql((statement) => client.exec(statement))
  holder().close = async () => {
    await client.close()
  }
  holder().driver = 'pglite'
  console.info(`[gym-rat] Baza: PGlite (${dir})`)
  return drizzle(client, { schema }) as unknown as Database
}

export function getDb() {
  const box = holder()
  if (!box.ready) {
    box.ready = open().catch((error) => {
      box.ready = undefined
      throw error
    })
  }
  return box.ready
}

export async function closeDb() {
  const box = holder()
  if (box.close) await box.close()
  box.ready = undefined
  box.close = undefined
}
