# supabase/

Database is defined by **migrations** (source of truth) — not by clicking around
the dashboard.

```
supabase/
  migrations/   Timestamped SQL files, applied in order
```

## Phase 2 will add

- `profiles`, `events`, `tasks` tables
- Enums / CHECK constraints, foreign keys, indexes
- `updated_at` auto-touch trigger
- `handle_new_user` trigger → creates a `profiles` row on sign-up
- Row Level Security: owner-only `select / insert / update / delete` on every table

## Applying migrations (Phase 2+)

Using the Supabase CLI (`npm i -g supabase` or `npx supabase`):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # apply migrations to the hosted project
# local dev DB:
npx supabase start
npx supabase db reset         # re-run all migrations against local
```

## Regenerating DB types

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```
