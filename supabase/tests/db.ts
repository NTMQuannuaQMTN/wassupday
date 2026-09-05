/**
 * In-memory Postgres (PGlite) test harness for the SQL migrations.
 *
 * It stands up just enough of Supabase's `auth` schema — `auth.users` and
 * `auth.uid()` reading `request.jwt.claims` — then applies every file in
 * `supabase/migrations/` in order. `asUser()` runs a callback with the Postgres
 * session switched to the `authenticated` (or `anon`) role and the JWT claims
 * a real PostgREST request would carry, so RLS is exercised exactly as in prod.
 *
 * Run with:  npm run test:db
 */

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

// Mimics the roles + auth helpers that already exist on a Supabase database.
const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to current_user;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
`;

export type TestDb = PGlite;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }

  return db;
}

export async function createUser(
  db: TestDb,
  opts: { email: string; displayName?: string; timezone?: string } = { email: `u${Math.random()}@t.dev` },
): Promise<string> {
  const meta: Record<string, string> = {};
  if (opts.displayName !== undefined) meta.display_name = opts.displayName;
  if (opts.timezone !== undefined) meta.timezone = opts.timezone;

  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [opts.email, JSON.stringify(meta)],
  );
  return res.rows[0].id;
}

/**
 * Execute `fn` as a PostgREST request would: as the `authenticated` role with
 * `request.jwt.claims.sub = userId`, or as `anon` when `userId` is null.
 */
export async function asUser<T>(
  db: TestDb,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const claims = userId ? JSON.stringify({ sub: userId, role: 'authenticated' }) : '';
  // set_config(..., is_local=false): plain session GUC, reset explicitly below.
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

/** Resolves true if the thunk rejects, false if it resolves. */
export async function rejects(thunk: () => Promise<unknown>): Promise<boolean> {
  try {
    await thunk();
    return false;
  } catch {
    return true;
  }
}
