import { boolean, date, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  token: text('token').notNull().unique(),
  avatarData: text('avatar_data'),
  avatarMime: text('avatar_mime'),
  avatarPath: text('avatar_path'),
  birthDate: date('birth_date', { mode: 'string' }),
  weightKg: doublePrecision('weight_kg'),
  heightCm: doublePrecision('height_cm'),
  level: text('level'),
  passType: text('pass_type'),
  trainingStart: date('training_start', { mode: 'string' }),
  passUsed: jsonb('pass_used').$type<boolean[]>().notNull().default([]),
  goal: text('goal').notNull().default(''),
  injuries: text('injuries').notNull().default(''),
  position: integer('position').notNull().default(0),
  removedAt: timestamp('removed_at', { withTimezone: true, mode: 'date' }),
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
  planDate: date('plan_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const blocks = pgTable('blocks', {
  id: uuid('id').primaryKey(),
  workoutId: uuid('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default(''),
  position: integer('position').notNull().default(0),
})

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey(),
  workoutId: uuid('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  blockId: uuid('block_id').references(() => blocks.id, { onDelete: 'cascade' }),
  blok: text('blok').notNull().default(''),
  cwiczenie: text('cwiczenie').notNull().default(''),
  serie: text('serie').notNull().default(''),
  reps: text('reps').notNull().default(''),
  opis: text('opis').notNull().default(''),
  done: boolean('done').notNull().default(false),
  imageData: text('image_data'),
  imageMime: text('image_mime'),
  imagePath: text('image_path'),
  position: integer('position').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const libraryExercises = pgTable('library_exercises', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  imageData: text('image_data'),
  imageMime: text('image_mime'),
  imagePath: text('image_path'),
  position: integer('position').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const schema = { clients, workouts, blocks, exercises, libraryExercises }

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

CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY,
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS blocks_workout_id_idx ON blocks(workout_id);

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

ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS weight_kg double precision;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS height_cm double precision;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pass_type text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS training_start date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pass_used jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS goal text NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS injuries text NOT NULL DEFAULT '';

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES blocks(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS opis text NOT NULL DEFAULT '';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_data text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_mime text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_path text;

CREATE INDEX IF NOT EXISTS exercises_block_id_idx ON exercises(block_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_date date;
UPDATE workouts SET plan_date = (created_at AT TIME ZONE 'Europe/Warsaw')::date WHERE plan_date IS NULL;

CREATE TABLE IF NOT EXISTS library_exercises (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  normalized_name text NOT NULL,
  image_data text,
  image_mime text,
  image_path text,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS library_exercises_active_name_idx
  ON library_exercises (normalized_name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS schema_version (
  id integer PRIMARY KEY,
  version integer NOT NULL
);
`
