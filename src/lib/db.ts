import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { migrateLegacyBlocks } from './migrate'
import { schema } from './schema'
import { SCHEMA_VERSION, isMissingRelation, migrateSchema, type SqlRow } from './schema-migrate'

export type Database = PostgresJsDatabase<typeof schema>

export type DbOptions = { migrate?: boolean }

type Sql = ReturnType<typeof import('postgres')>

type PgliteClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>
  exec(sql: string): Promise<unknown>
  close(): Promise<void>
}

type Holder = {
  sql?: Sql
  migrated?: Promise<void>
  pglite?: Promise<PgliteClient>
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

function noticeLogger(notice: { severity?: string; code?: string; message?: string }) {
  if (!notice.severity || notice.severity === 'NOTICE' || notice.severity === 'DEBUG' || notice.severity === 'INFO' || notice.severity === 'LOG') {
    return
  }
  console.error('[gym-rat] postgres', notice.severity, notice.code, notice.message)
}

async function postgresClient() {
  const box = holder()
  if (box.sql) return box.sql
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('DATABASE_URL jest wymagany.')
  const local = /localhost|127\.0\.0\.1/.test(databaseUrl)
  const postgres = (await import('postgres')).default
  box.sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? undefined : 'require',
    onnotice: noticeLogger,
  })
  box.driver = 'postgres'
  box.close = async () => {
    await box.sql?.end({ timeout: 5 })
  }
  console.info('[gym-rat] Baza: Postgres')
  return box.sql
}

async function pgliteClient() {
  const box = holder()
  if (!box.pglite) {
    box.pglite = openPglite()
  }
  return box.pglite
}

async function openPglite(): Promise<PgliteClient> {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL jest wymagany na produkcji. Zobacz README.')
  }
  const { mkdir } = await import('node:fs/promises')
  const path = await import('node:path')
  const dir = process.env.PGLITE_DIR?.trim() || path.join(process.cwd(), 'data', 'pglite')
  await mkdir(dir, { recursive: true })
  const { PGlite } = await import('@electric-sql/pglite')
  const client = (await PGlite.create(dir)) as unknown as PgliteClient
  holder().close = async () => {
    await client.close()
  }
  holder().driver = 'pglite'
  console.info(`[gym-rat] Baza: PGlite (${dir})`)
  return client
}

async function currentVersion(read: () => Promise<SqlRow[]>): Promise<number | null | 'missing'> {
  try {
    const rows = await read()
    const version = rows[0]?.version
    return typeof version === 'number' ? version : version == null ? null : Number(version)
  } catch (error) {
    if (isMissingRelation(error)) return 'missing'
    throw error
  }
}

async function ensurePostgresMigrated(sql: Sql) {
  const box = holder()
  if (!box.migrated) {
    box.migrated = migratePostgres(sql).catch((error) => {
      box.migrated = undefined
      console.error('[gym-rat] migracja', error)
      throw error
    })
  }
  return box.migrated
}

async function migratePostgres(sql: Sql) {
  const version = await currentVersion(async () => sql`SELECT version FROM schema_version WHERE id = 1`)
  if (version === SCHEMA_VERSION) return

  await sql.begin(async (tx) => {
    await tx.unsafe(`SELECT pg_advisory_xact_lock(${847221904})`)
    const rel = await tx.unsafe(`SELECT to_regclass('public.schema_version') AS rel`)
    if (rel[0]?.rel) {
      const rows = await tx.unsafe(`SELECT version FROM schema_version WHERE id = 1`)
      const again = rows[0]?.version
      if (Number(again) === SCHEMA_VERSION) return
    }
    console.info('[gym-rat] migracja schematu', SCHEMA_VERSION)
    await migrateSchema({
      unsafe: async (statement, params) => (await tx.unsafe(statement, params as never[])) as SqlRow[],
    })
  })
  const db = drizzlePostgres(sql, { schema })
  await migrateLegacyBlocks(db)
  await sql`
    INSERT INTO schema_version (id, version) VALUES (1, ${SCHEMA_VERSION})
    ON CONFLICT (id) DO UPDATE SET version = ${SCHEMA_VERSION}
  `
}

async function ensurePgliteMigrated(client: PgliteClient) {
  const box = holder()
  if (!box.migrated) {
    box.migrated = migratePglite(client).catch((error) => {
      box.migrated = undefined
      console.error('[gym-rat] migracja', error)
      throw error
    })
  }
  return box.migrated
}

async function migratePglite(client: PgliteClient) {
  const version = await currentVersion(async () => {
    const result = await client.query<SqlRow>('SELECT version FROM schema_version WHERE id = 1')
    return result.rows
  })
  if (version === SCHEMA_VERSION) return

  await client.exec('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [847221904])
    const rel = await client.query<SqlRow>(`SELECT to_regclass('public.schema_version') AS rel`)
    if (rel.rows[0]?.rel) {
      const rows = await client.query<SqlRow>('SELECT version FROM schema_version WHERE id = 1')
      if (Number(rows.rows[0]?.version) === SCHEMA_VERSION) {
        await client.exec('COMMIT')
        return
      }
    }
    console.info('[gym-rat] migracja schematu', SCHEMA_VERSION)
    await migrateSchema({
      unsafe: async (statement, params) => {
        const result = await client.query<SqlRow>(statement, params)
        return result.rows ?? []
      },
    })
    await client.exec('COMMIT')
    const { drizzle } = await import('drizzle-orm/pglite')
    const db = drizzle(client as never, { schema }) as unknown as Database
    await migrateLegacyBlocks(db)
    await client.query(
      `INSERT INTO schema_version (id, version) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version`,
      [SCHEMA_VERSION],
    )
  } catch (error) {
    await client.exec('ROLLBACK').catch(() => undefined)
    throw error
  }
}

export async function getDb(options?: DbOptions) {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    const sql = await postgresClient()
    if (options?.migrate !== false) await ensurePostgresMigrated(sql)
    return drizzlePostgres(sql, { schema })
  }
  const client = await pgliteClient()
  if (options?.migrate !== false) await ensurePgliteMigrated(client)
  const { drizzle } = await import('drizzle-orm/pglite')
  return drizzle(client as never, { schema }) as unknown as Database
}

export async function closeDb() {
  const box = holder()
  if (box.close) await box.close()
  box.sql = undefined
  box.pglite = undefined
  box.migrated = undefined
  box.close = undefined
  box.driver = undefined
}
