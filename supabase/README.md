# supabase/

The database is defined by **migrations** (the source of truth) — not by
clicking around the dashboard.

```
supabase/
  config.toml           Local dev + auth configuration (committed)
  migrations/            Timestamped SQL, applied in order
  tests/                 PGlite RLS / isolation tests  ->  npm run test:db
  seed.sql              Local dev seed (empty for now)
```

## Schema (migration `20260904000100_init_schema.sql`)

- `profiles` (1:1 with `auth.users`, created by the `handle_new_user` trigger),
  `events`, `tasks`
- CHECK constraints for every enum-like column + `events.end_time >= start_time`
- Indexes: `events(user_id, start_time)`, `tasks(user_id, status, due_date)`
- `set_updated_at` trigger on all three tables
- **RLS on every table**, `to authenticated`, keyed on `(select auth.uid())`;
  `anon` is granted nothing
- SECURITY DEFINER functions pin `search_path = ''` and schema-qualify everything

## Auth configuration

`config.toml`'s `[auth]` section is the source of truth and is kept in sync
with the **hosted** project via `supabase config push` (already done for the
live project as of 2026-09-04 — see PROGRESS.md):

| Setting | Value |
| --- | --- |
| Confirm email | **off** — `signUp` returns a session immediately, no verification step |
| Minimum password length | 10 |
| Password requirements | letters + digits |
| Site URL / redirect | `wassupday://` |

`signUp` → session. No OTP, no link, no verify screen. See PROGRESS.md
("Auth simplified…") for the trade-off this accepts.

## Local development

Needs Docker running.

```bash
npx supabase start                     # boots Postgres, Auth, Studio, Inbucket
npx supabase db reset                  # re-run all migrations (+ seed)
# put the printed API URL + anon key in .env.local, then `npm start`
```

## Deploying to the hosted project

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push                   # apply migrations
npx supabase config push               # apply auth config — pushes the whole
                                        # [auth] section; review the printed
                                        # diff, it touches more than just one
                                        # setting (password policy, site_url, …)
```

## Regenerating DB types

After a schema change, replace the hand-written `src/types/database.ts`:

```bash
npx supabase gen types typescript --local > src/types/database.ts
# or --project-id <ref> for the hosted schema
```

## Tests

`npm run test:db` stands up an in-memory Postgres (PGlite), fakes just enough of
Supabase's `auth` schema, applies every migration, and asserts the RLS model
(cross-user isolation, forged `user_id`, `anon` lockout, CHECK constraints).
No Docker required.
