# wassupday — agent notes

**This project targets Expo SDK 54 (RN 0.81, React 19.1, expo-router 6). Check the
versioned docs (https://docs.expo.dev/versions/v54.0.0/) before writing
Expo/router/native code. Do not bump the SDK without being asked.**

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

## Checks

`npm run check` = `typecheck` + `lint` + `test`. Also `npx expo-doctor`.
