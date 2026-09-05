# wassupday — agent notes

**This project targets Expo SDK 57 (RN 0.86, React 19.2, expo-router 57). Check the
versioned docs (https://docs.expo.dev/versions/v57.0.0/) before writing
Expo/router/native code — APIs move between SDKs (e.g. `ThemeProvider`/
`DarkTheme`/`DefaultTheme` come from `expo-router` itself here, not
`@react-navigation/native`). Do not bump the SDK without being asked.**

## What this is

Mobile-first daily planner. One job: "what do I need to do today?" See
`IMPLEMENTATION_PLAN.md`, `TASKS.md`, `PROGRESS.md`. Build one phase at a time;
`npm run check` must pass before advancing.

## Conventions

- **Routes:** `src/app/` (Expo Router, typed routes, file-based).
- **Import alias:** `@/` → `src/`.
- **Layering:** screen → feature hook (`src/features/<domain>`) → service
  (`src/services`) → `src/lib/supabase`. UI never imports the Supabase client.
- **Pure logic** (conflicts, Today snapshot, time) lives in `src/lib/` with unit
  tests next to it (`*.test.ts`). No React, no I/O, no `new Date()` inside —
  take `now` as a parameter.
- **Types:** domain models in `src/types/models.ts`; DB rows in
  `src/types/database.ts`. Services map between them.
- **Styling:** `constants/theme.ts` tokens + `ThemedText` / `ThemedView`. Color
  is semantic only (danger/warning/success). No NativeWind (see PROGRESS.md).
- **Secrets:** only `EXPO_PUBLIC_*` vars, and only the Supabase URL + publishable
  key. Never the service-role key. RLS is the access control.

## Security (non-negotiable)

- **Never build SQL by string.** Use supabase-js query builders / RPC with
  args. All input crosses PostgREST parameterization.
- **Every table has RLS**, `to authenticated`, keyed on `(select auth.uid())`.
  New tables: enable RLS + add per-op policies in the same migration, `revoke`
  from `anon`, grant least privilege to `authenticated`. Add a case to
  `supabase/tests/rls.test.ts`.
- **`user_id` columns**: `default auth.uid()` + `WITH CHECK ((select auth.uid()) = user_id)`.
  Never trust a client-supplied owner id.
- **SECURITY DEFINER functions**: `set search_path = ''`, fully schema-qualify.
- **Client input**: validate through `src/lib/validation.ts` allow-list helpers
  before sending. Auth errors must not enable account enumeration.
- **Auth:** `src/services/auth.ts` is the only `supabase.auth.*` caller. Session
  is encrypted at rest (`LargeSecureStore`) and must survive process kill but
  not app reinstall — don't weaken `ensureFreshInstallPurge` or the
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keychain option.

## Checks

`npm run check` = `typecheck` + `lint` + `test` + `test:db`. Also
`npx expo-doctor`. `test:db` = PGlite RLS tests (`node --test`, no Docker).
DB schema changes: also run against a real DB (`supabase start && supabase db reset`).
