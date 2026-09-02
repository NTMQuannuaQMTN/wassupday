# wassupday — Tasks

Phased build of the V1 daily planner. One phase at a time; tests must pass before
moving on. Status: `[ ]` todo · `[~]` in progress · `[x]` done.

Legend for "Tests": the checks that must be green to close the phase.

---

## Phase 1 — Project setup `[x]`

- [x] Scaffold Expo (SDK 57) app, TypeScript strict, Expo Router
- [x] Restructure to `src/` clean architecture (`app / components / features / lib / services / hooks / types`)
- [x] Add Supabase client (`@supabase/supabase-js`) with encrypted session storage (`expo-secure-store` + AsyncStorage + aes-js)
- [x] Session auto-refresh tied to app foreground/background
- [x] Environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, validated in `lib/env.ts`, `.env.example`
- [x] Design tokens (`constants/theme.ts`) — neutral palette + semantic colors, light/dark
- [x] Shared types: `types/models.ts` (domain), `types/database.ts` (rows)
- [x] Pure time helpers (`lib/time.ts`) + tests
- [x] Jest (`jest-expo`) wired up; `npm test` / `npm run typecheck` / `npm run lint`
- [x] `supabase/` folder with migrations dir
- [x] README with exact setup + run instructions
- **Tests:** `npm test` (10), `npm run typecheck`, `npx expo-doctor`, iOS bundle export ✅

## Phase 2 — Database `[ ]`

- [ ] Migration: `profiles` (id → auth.users, display_name, timezone, timestamps)
- [ ] Migration: `events` (user_id, title, description, start_time, end_time, location, category, source, timestamps)
- [ ] Migration: `tasks` (user_id, title, description, due_date, priority, estimated_duration, status, source, timestamps)
- [ ] Enums / CHECK constraints for category, priority, status, source
- [ ] CHECK `end_time >= start_time` on events
- [ ] Indexes: `events(user_id, start_time)`, `tasks(user_id, status, due_date)`
- [ ] `updated_at` auto-touch trigger (shared function)
- [ ] Trigger: create a `profiles` row on new `auth.users`
- [ ] RLS enabled + owner-only SELECT/INSERT/UPDATE/DELETE policies on all three tables
- [ ] `supabase/README.md` — how to run migrations locally + on the hosted project
- [ ] Regenerate `types/database.ts` from the live schema
- **Tests:** RLS isolation test (user A cannot read user B); migration applies clean on a fresh DB

## Phase 3 — Authentication `[ ]`

- [ ] `features/auth`: sign-up, sign-in, sign-out
- [ ] `AuthProvider` / `useSession` hook wrapping `supabase.auth`
- [ ] Root auth gate in `app/` — redirect to `(auth)` or `(app)` by session
- [ ] Persistent session verified across cold start
- [ ] Minimal onboarding (display name → profile)
- **Tests:** session reducer/hook logic; auth-gate redirect logic

## Phase 4 — Events CRUD `[ ]`

- [ ] `services/events.ts` — list (by range), get, create, update, delete; row↔model mapping
- [ ] `features/events` — list, detail, create/edit form (bottom sheet/modal)
- [ ] Timezone-correct storage (timestamptz) + display in device tz
- **Tests:** row↔model mapping, range filtering, timezone round-trip

## Phase 5 — Tasks CRUD `[ ]`

- [ ] `services/tasks.ts` — list, get, create, update, delete, toggle complete
- [ ] `features/tasks` — Today / Upcoming / Completed sections, quick-complete
- **Tests:** completion toggle, overdue detection, section bucketing

## Phase 6 — Today dashboard `[ ]`

- [ ] `features/today` — greeting, date, NEXT, timeline, tasks, conflicts
- [ ] `lib/todaySnapshot.ts` — pure `buildTodaySnapshot(events, tasks, now)` → `TodaySnapshot`
- [ ] `useTodaySnapshot` hook (real Supabase data, refetch on focus + date change)
- [ ] Date-transition handling (23:59 → 00:00 rolls the view over)
- **Tests:** snapshot generation — current/next/upcoming, priority + overdue tasks, empty states, date rollover

## Phase 7 — Conflict detection `[ ]`

- [ ] `lib/conflicts.ts` — pure `detectConflicts(events)` using `a.start < b.end && a.end > b.start`
- [ ] Wire into Today snapshot + event save flow
- [ ] Unobtrusive conflict UI
- **Tests:** overlap / touching-edges / nested / multi-conflict / no-conflict cases

## Phase 8 — Widgets `[ ]`

- [ ] Research current Expo + iOS WidgetKit + Android App Widget approach (pick a maintained lib, don't guess)
- [ ] Shared "Today Snapshot" written to platform-shared storage (App Group / shared prefs)
- [ ] iOS: small (next event + task count), medium (2–3 events + top tasks)
- [ ] iOS lock-screen widget where supported
- [ ] Android: home-screen widget (next event, upcoming, priority tasks)
- [ ] OS-respecting refresh + new-day behavior; document refresh limits
- **Tests:** snapshot serialization for the widget payload (independent of native UI)

---

## Cross-cutting / Definition of Done

- [ ] All Phase checklists complete
- [ ] `npm test`, `npm run typecheck`, `npm run lint` green
- [ ] RLS protects all user data
- [ ] Persistent auth survives app restart
- [ ] Platform limitations documented in PROGRESS.md
- [ ] README setup/run instructions verified from a clean clone

## Explicitly NOT in V1

AI planner · timetable/image OCR · vision AI · Google Calendar / email sync ·
voice assistant · full personal agent · Cloudflare · teams/collaboration ·
recurring-event engine · Kanban.
