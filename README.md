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

> **A development build is now required for the device calendar feature.**
> `expo-calendar` is a native module that is **not** in Expo Go. Everything
> else still runs in Expo Go, but to see the "Connect your calendar" flow and
> real events you need a dev build:
>
> ```bash
> npx expo prebuild            # generates ios/ and android/ (first time only)
> npx expo run:ios             # or: npx expo run:android  (builds + installs a dev client)
> # thereafter, just: npx expo start  (it connects to the installed dev client)
> ```
>
> On first launch the app asks for calendar access **only when you tap
> "Connect Calendar"** on the Today screen. iOS grants "Full Access" (there is
> no read-only tier on iOS 17+) — the app still only ever reads.
>
> The `expo-calendar` config plugin also adds Android `WRITE_CALENDAR` (no
> opt-out in the current version); the app never calls a write API.

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

## Device calendar (read-only)

The Today screen shows a "Connect your calendar" card until you grant access.
Once connected it reads the device's Calendar app (Apple Calendar + any Google/
Outlook account synced into it) and merges those events into NEXT / TODAY /
CONFLICTS, with a 7-day UPCOMING section. Read-only — WassupDay never creates,
edits or deletes calendar events, and nothing is synced to Supabase. Events
re-read on focus, pull-to-refresh, and when the app returns from the background.
Requires a dev build (see Prerequisites). Manual test matrix: `TASKS.md` →
"Feature 1"; spec §17.

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
    tasks/        use-tasks, task-form, task-list-item
    today/        use-today-snapshot (merges events + tasks + device calendar)
    calendar/     use-device-calendar, calendar-connect-card
  hooks/          Cross-cutting hooks
  lib/            Framework/infra glue (all pure logic is tested)
    env.ts / supabase.ts / validation.ts / time.ts
    conflicts.ts / todaySnapshot.ts / taskBuckets.ts
  services/       Data access — auth.ts, events.ts, tasks.ts
    calendar/     device-calendar reads (expo-calendar); types + permissions +
                  pure normalizer + service orchestration
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

Tracked honestly in [PROGRESS.md](PROGRESS.md). Highlights so far:

- **Device calendar needs a development build** — `expo-calendar` is not in Expo Go.
- iOS 17+ has no read-only calendar permission — the app requests Full Access
  and only ever reads.
- The `expo-calendar` plugin adds Android `WRITE_CALENDAR` with no opt-out; the
  app never writes.
- No incremental calendar sync — events are re-fetched by date range on focus /
  foreground / pull-to-refresh.
- Widgets (Phase 8) will also require a development build; Android lock-screen
  widgets are out of scope.
