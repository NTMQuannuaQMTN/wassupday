# wassupday

A calm, mobile-first daily planner. Open the phone → immediately understand your day:
what's happening today, what to do next, and whether anything clashes.

> **Status:** foundation, schema + auth, and events CRUD built. Tasks and the
> Today dashboard are next. See [PROGRESS.md](PROGRESS.md) and
> [TASKS.md](TASKS.md).

## Tech stack

| Layer      | Choice                                              |
| ---------- | -------------------------------------------------- |
| App        | React Native 0.86 via **Expo SDK 57** (managed)    |
| Language   | TypeScript (strict)                                 |
| Navigation | Expo Router (file-based, typed routes)              |
| Backend    | Supabase — Auth, PostgreSQL, Row Level Security     |
| Storage    | `expo-secure-store` + AsyncStorage (encrypted session) |
| Styling    | Themed primitives + `StyleSheet` design tokens      |
| Tests      | Jest via `jest-expo`                                |

```
React Native / Expo
        ↓
     Supabase
        ├── Auth
        ├── PostgreSQL (RLS)
        └── Storage (later)
```

## Prerequisites

- **Node.js ≥ 22.13** (`node -v`)
- npm
- A **Supabase** project (free tier is fine) — <https://supabase.com/dashboard>
- To run on a device/simulator:
  - iOS: macOS + Xcode 26.4+ (Simulator), or the **Expo Go** app / a dev build
  - Android: Android Studio + an emulator (API 24+), or Expo Go

> Note: this project uses native config plugins (`expo-secure-store`), so the
> classic Expo Go client works for most of the app, but a **development build**
> (`npx expo run:ios` / `npx expo run:android`) is recommended and will be
> required for the widgets in Phase 8.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then edit .env.local and set:
#     EXPO_PUBLIC_SUPABASE_URL              = https://<ref>.supabase.co
#     EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = <publishable / anon key>
#   Both come from: Supabase Dashboard → Project Settings → API.
#   These are safe to ship in the client; data is protected by RLS.
#   NEVER put the service-role key here.

# 3. Set up the database
#   Local (needs Docker):
npx supabase start
npx supabase db reset          # applies supabase/migrations + seed
#   ...then copy the printed API URL + anon key into .env.local.
#   Hosted: npx supabase link --project-ref <ref> && npx supabase db push
#   See supabase/README.md for the auth dashboard settings that must match.
```

## Auth

Email + password, no email-confirmation step — `signUp` returns a session
immediately. The session persists across app restarts and device reboots and
only ends on explicit sign-out or when the app is deleted (see PROGRESS.md for
the trade-off this design accepts).

## Run

```bash
npx expo start       # start Metro; press i / a / w for iOS / Android / web
npx expo start --ios       # start + open iOS simulator
npx expo start --android   # start + open Android emulator
npx expo start --web       # start + open web
```

(`npm start`, `npm run ios/android/web` are thin wrappers around the same.)

## Checks

```bash
npm test             # Jest unit tests
npm run test:db      # PGlite RLS / schema-isolation tests (no Docker needed)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run check        # all of the above
```

## Project structure

```
src/
  app/            Expo Router routes
    _layout.tsx   Root: AuthProvider + Stack.Protected auth gate
    (auth)/       sign-in, sign-up (signed out)
    (app)/        Stack: (tabs) + event/new, event/[id], event/[id]/edit
      (tabs)/     Today | Calendar | + | Tasks | Profile
  components/      Shared presentational UI (ThemedText, TextField, DateTimeField, …)
  constants/      Design tokens (theme.ts)
  features/       Feature modules — UI + hooks per domain
    auth/         auth-context.tsx (session state)
    events/       use-events (hooks), event-form, event-list-item
    tasks/  today/
  hooks/          Cross-cutting hooks
  lib/            Framework/infra glue
    env.ts        Validated public env vars
    supabase.ts   Supabase client + encrypted session storage
    validation.ts Pure allow-list input validators (tested)
    time.ts       Pure date/time helpers (tested)
  services/       Data access — auth.ts, events.ts; row <-> model mappers
  types/          Shared types (models.ts, database.ts)
supabase/
  migrations/     SQL migrations (source of truth for the schema)
  config.toml     Local dev + auth config
  tests/          PGlite RLS tests — npm run test:db
scripts/
  smoke.mjs       Full real round-trip against the live project (see below)
```

### Smoke test (real backend)

```bash
node scripts/smoke.mjs you+wsd1@gmail.com 'a-strong-password-1'
# signs up (session returned immediately) → creates an event →
# checks RLS hides it from anon → deletes → signs out
# use a fresh alias each run — Supabase now rejects a repeat signup
```

Layering rule: **UI → services → Supabase**. UI never imports the Supabase
client directly; business logic (conflict detection, Today snapshot) is pure and
lives in `lib/` / `services/` so it stays testable and reusable by the widgets.

## Environment variables

| Variable                              | Required | Notes                                        |
| ------------------------------------- | -------- | -------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`            | yes      | Project URL. Public.                          |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| yes      | Publishable/anon key. Public. RLS enforces access. |

Loaded from `.env.local` (git-ignored). Only `EXPO_PUBLIC_`-prefixed values are
bundled — and they are visible in the shipped binary, so never store secrets in
them.

## Platform limitations

Tracked honestly in [PROGRESS.md](PROGRESS.md#platform-limitations). Highlights so
far: widgets (Phase 8) require a development build, not Expo Go; Android
lock-screen widgets are not universally supported and are out of scope.
