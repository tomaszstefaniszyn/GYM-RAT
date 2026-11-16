import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  token: text('token').notNull().unique(),
  avatarData: text('avatar_data'),
  avatarMime: text('avatar_mime'),
  avatarPath: text('avatar_path'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const workouts = pgTable('workouts', {
  id: uuid('id').primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey(),
  workoutId: uuid('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  blok: text('blok').notNull().default(''),
  cwiczenie: text('cwiczenie').notNull().default(''),
  serie: text('serie').notNull().default(''),
  reps: text('reps').notNull().default(''),
  done: boolean('done').notNull().default(false),
  position: integer('position').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const schema = { clients, workouts, exercises }

export const schemaSql = `
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  avatar_data text,
  avatar_mime text,
  avatar_path text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workouts_client_id_idx ON workouts(client_id);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY,
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  blok text NOT NULL DEFAULT '',
  cwiczenie text NOT NULL DEFAULT '',
  serie text NOT NULL DEFAULT '',
  reps text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercises_workout_id_idx ON exercises(workout_id);
`
