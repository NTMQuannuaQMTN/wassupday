# wassupday — Tasks

Phased build of the V1 daily planner. One phase at a time; tests must pass before
moving on. Status: `[ ]` todo · `[~]` in progress · `[x]` done.

Legend for "Tests": the checks that must be green to close the phase.

---

## Demo polish pass (2026-09-10) `[x]`

Goal: bring the prototype to a coherent, demo-ready state that runs fully in
**Expo Go** (no dev build, no calendar integration). Everything shows realistic
data from a single swappable local source.

### Audit — state before this pass

- Screens: Today, Calendar, Tasks, Profile tabs + event/task detail & modal
  forms + auth (sign-in / sign-up). Navigation all wired.
- Auth (Supabase), Events CRUD, Tasks CRUD, Today snapshot, conflict detection —
  all implemented and unit-tested (156 jest + 9 RLS). `npm run check` green.
- **Blocking for a demo:** the `events` and `tasks` Supabase tables are empty, so
  every screen showed empty states. The Today screen opened a "Calendar needs a
  development build" modal on every visit (Expo Go). UPCOMING never populated
  (it read `calendar.upcomingEvents`, always `[]` in Expo Go).

### Done

- [x] Single local demo data source: `services/demo/` (`demo-seed.ts` pure
      builders anchored to `now`, `demo-store.ts` in-memory state,
      `demo-events.ts` / `demo-tasks.ts` service-shaped CRUD).
- [x] Swap points `services/event-source.ts` / `services/task-source.ts` — one
      line to switch demo ↔ Supabase ↔ (later) device calendar. Hooks/screens
      import only these; the real Supabase services + tests are untouched.
- [x] Realistic seed: CS1231S / MA1521 / CS2040S / GEA1000 classes, team meeting,
      gym, plus a deliberate overlap (Team Meeting × MA1521 Consultation) so the
      CONFLICTS section demos, an overdue task, and a completed task.
- [x] Today screen: removed all calendar-permission UI; NEXT/NOW card, TODAY
      timeline, UPCOMING (from the event source), TASKS, CONFLICTS — all
      populated. Personalised greeting. Pull-to-refresh. Consistent section
      headers.
- [x] Walked every interaction in code: tab nav, +/Add chooser, event & task
      create/edit/delete, quick-complete, back nav, empty/error/loading states,
      modals, pull-to-refresh, `numberOfLines` clamping on long titles. No
      dead controls. Live on-device gesture feel still needs a simulator run.
- [x] Calendar feature code (`services/calendar/*`, `features/calendar/*`) left
      in place, unused, ready for the calendar phase.

### Remaining / next

- [ ] Device calendar integration (its own phase — see below).
- [ ] Optional: persist demo mutations to AsyncStorage (currently reset on
      reload, which is fine for a demo).

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

## Phase 2 — Database `[x]`

- [x] Migration `20260904000100_init_schema.sql`: `profiles`, `events`, `tasks`
- [x] CHECK constraints for category / priority / status / source; `end_time >= start_time`
- [x] Indexes: `events(user_id, start_time)`, `tasks(user_id, status, due_date)`, `tasks(user_id, due_date)`
- [x] `set_updated_at` trigger (shared, search_path-pinned)
- [x] `handle_new_user` trigger → creates a `profiles` row on new `auth.users` (SECURITY DEFINER, `search_path=''`)
- [x] RLS on all three tables, `to authenticated`, `(select auth.uid())`; least-privilege grants; `anon` gets nothing
- [x] `supabase/config.toml` (auth: min password 10, letters+digits, confirm-email off — see PROGRESS.md); pushed live via `supabase config push`
- [x] `supabase/README.md` — local + hosted workflow
- [x] `src/types/database.ts` kept in sync by hand (regen documented for post-`supabase start`)
- **Tests:** `npm run test:db` — 9 PGlite RLS tests (isolation, forged user_id, anon lockout, CHECK constraints); migration applies clean on a fresh DB ✅

## Phase 3 — Authentication `[x]`

- [x] `services/auth.ts` — sign-up (session returned immediately, no confirmation step), sign-in, sign-out; input re-validated; errors mapped
- [x] `lib/validation.ts` — email / password (bcrypt 72-byte cap) / display-name allow-list validators + tests
- [x] `AuthProvider` / `useAuth` wrapping `supabase.auth` (getSession + onAuthStateChange)
- [x] Root auth gate — `Stack.Protected` groups `(app)` / `(auth)`, splash held until session resolves
- [x] Screens: `(auth)/sign-in`, `(auth)/sign-up`
- [x] **Forgot password / reset password (2026-09-11)** — `services/auth.ts`: `requestPasswordReset` (always reports success — never reveals whether the email has an account), `exchangeRecoveryCode`, `updatePassword`. Client set to PKCE `flowType` (was implicit) so the reset link carries a `?code=` query param instead of a URL fragment RN can't parse. `(auth)/forgot-password.tsx` (email → "check your email" state); `(auth)/sign-in.tsx` gets a "Forgot password?" link; root-level `reset-password.tsx` (deliberately outside both `Stack.Protected` groups — exchanging the code creates a session mid-flow, before a new password is set) handles the `wassupday://reset-password?code=...` deep link, exchanges it, then collects + confirms a new password. `supabase/config.toml`'s `additional_redirect_urls` updated to allow that redirect — **still needs `supabase config push` (or the dashboard) with real project credentials to take effect live; not done here (no CLI login in this environment).**
- [x] **Dev-only test bypass** — since the config push above hasn't happened, a real emailed link can't reach `reset-password.tsx` yet. Added `__DEV__`-gated "simulate clicking the link" buttons: one on `forgot-password.tsx`'s "check your email" state, one on `profile.tsx` (reachable while already signed in, so it exercises the real `updatePassword` write against a live session/account — sign out and back in with the new password to confirm it persisted). Both compile out of release builds (`__DEV__` is `false` there). **Verified live** in the iOS Simulator dev build: sign-in screen, "Forgot password?" link, and the app in general all render correctly after these changes; `tsc`/`eslint`/`jest` all green throughout. Full tap-through of the dev-bypass buttons themselves wasn't done — this sandbox can't simulate touch (no `idb`, no Accessibility permission for AppleScript, and `simctl openurl` raises an OS confirmation dialog that also needs a tap) — ready for the user to click through by hand in the already-running simulator.
- [x] Persistent session across cold start (encrypted SecureStore + AsyncStorage); `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
- [x] "Logged out on reinstall" — `ensureFreshInstallPurge()` clears stale keychain material on first launch
- [x] Display name → `profiles` via `raw_user_meta_data` + `handle_new_user`
- [x] Supabase project created + `.env.local` filled; schema deployed; confirm-email turned **off** live (`supabase config push`, verified via REST)
- **Tests:** `services/auth.test.ts`, `lib/validation.test.ts`. Auth-gate/redirect is declarative (`Stack.Protected`).
- [ ] Manual: `scripts/smoke.mjs` real round-trip, then simulator (sign up → straight in → kill app → reopen still signed in)
- [ ] Password reset flow (deferred — not in the V1 "done" list; note account-ownership trade-off from dropping confirmation, see PROGRESS.md)

## Phase 4 — Events CRUD `[x]`

- [x] `services/events.ts` — list-by-range (overlap), get, create, update, delete; `rowToEvent` mapping; `user_id` never client-sent
- [x] `validateEventInput` mirrors DB CHECK constraints
- [x] `features/events` — `use-events` hooks (focus refetch + pub/sub), `event-form`, `event-list-item`
- [x] Bottom tabs (Today | Calendar | + | Tasks | Profile); centre + opens the new-event modal
- [x] Screens: calendar (grouped list), event detail, event new/edit (modal), delete with confirm
- [x] Timezone-correct: `timestamptz` stored as ISO; displayed in device tz via `lib/time` helpers
- [x] Shared UI: `screen`, `text-field`, `primary-button`, `datetime-field`, `states`
- **Tests:** `services/events.test.ts` (9 — mapping, validation, no-`user_id` payloads), `lib/time.test.ts` +14
- [ ] Manual: create/edit/delete an event in the simulator

## Phase 5 — Tasks CRUD `[x]`

- [x] `services/tasks.ts` — list active/completed, get, create, update, delete, `setTaskStatus` toggle
- [x] `lib/taskBuckets.ts` — pure `isTaskOverdue`, `compareByPriority`, `bucketTasksForList` (Today/Upcoming/Completed)
- [x] `features/tasks` — `use-tasks.ts` hooks, `task-form.tsx`, `task-list-item.tsx` (quick-complete checkbox)
- [x] Screens: Tasks tab (3 sections), `task/new`, `task/[id]/edit` (modal, incl. delete + mark complete)
- [x] "+" tab now offers an Add Event / Add Task chooser (`Alert.alert`)
- **Tests:** `services/tasks.test.ts` (mapping, validation, never sends `user_id`/`status`/`source` on create, `setTaskStatus` payload is exactly `{status}`), `lib/taskBuckets.test.ts` (overdue detection, section bucketing, priority ordering)
- [ ] Manual: create/complete/edit/delete a task in the simulator

## Phase 6 — Today dashboard `[x]`

- [x] `lib/todaySnapshot.ts` — pure `buildTodaySnapshot(events, tasks, now)` → `TodaySnapshot`; does its own day-boundary filtering from `now` so it's reusable with a wider input window
- [x] `useTodaySnapshot` hook — composes `useDayEvents` + `useActiveTasks`, real Supabase data
- [x] Date-transition handling: `useFocusEffect` refetch + a 60s poll comparing the local date key (rolls the view over without a per-second ticker)
- [x] Today screen rewritten: greeting/date → NEXT (current/next event) → TODAY timeline → TASKS (overdue + priority) → CONFLICTS (only when non-empty)
- **Tests:** `lib/todaySnapshot.test.ts` — current/next/upcoming selection + cap, priority/overdue ordering + no double-counting, empty states, conflicts wiring, **date rollover** (same fixtures, `now` either side of midnight)

## Phase 7 — Conflict detection `[x]`

- [x] `lib/conflicts.ts` — pure `detectConflicts(events)`, `a.start < b.end && a.end > b.start` (touching edges are not a conflict), sorted-scan with early break
- [x] Wired into Today snapshot (scoped to today's events)
- [x] Wired into the event save flow: passively (save → `notifyEventsChanged()` → Today's focus-refetch recomputes conflicts for real) and actively (`event-form.tsx` shows a debounced, non-blocking inline hint while editing start/end)
- [x] Unobtrusive conflict UI — the CONFLICTS section is absent entirely when clear, not an empty placeholder
- **Tests:** `lib/conflicts.test.ts` — none/overlap+window/touching-edges/nested/identical/multiple-pairs/order-independence

## Feature 1 — Device Calendar Integration (read-only) `[x]` (code) · `[ ]` (device verification)

Connect the device calendar (iOS/Android native Calendar app — covers Apple
Calendar + any account synced into it) and show today's + upcoming events on the
Today screen. Read-only: no writing, creating, deleting or two-way sync.

- [x] `expo-calendar@~57.0.3` installed; config plugin in `app.json` with a read-focused permission string
- [x] `services/calendar/` — `types.ts` (`DeviceCalendarEvent` model), `native.ts` (lazy `require('expo-calendar')` — Expo-Go-safe), `calendar-permissions.ts` (check / request / open Settings), `calendar-normalizer.ts` (pure: raw → model, date-range builders, sort, today/upcoming filters, `toDomainEvent` adapter), `calendar-service.ts` (`getEventCalendars`, `getTodayEvents`, `getUpcomingEvents`), `index.ts` barrel
- [x] `features/calendar/use-device-calendar.ts` — permission state + `todayEvents` / `upcomingEvents` / `isLoading` / `isRefreshing` / `error` / `connect` / `refresh` / `openSettings`; refreshes on connect, focus, pull-to-refresh, app foreground; race-guarded (`inFlightRef`); Expo Go detected via `expo-constants` execution environment (`unavailable: 'expo-go'`), never touches the native module there
- [x] Permission UX: `CalendarPermissionContent` (shared copy for 3 modes: ask / blocked / expo-go) rendered both as a centered `CalendarPermissionModal` (shown once per session, the first time Today resolves a non-granted status) and a persistent inline `CalendarConnectCard`; "denied + can't ask again" → Open Settings; the OS prompt only fires from "Connect Calendar"
- [x] **Wired into the Today screen** (2026-09-11): `useTodaySnapshot` now merges `event-source` events with `useDeviceCalendar`'s `todayEvents`/`upcomingEvents` (via `toDomainEvent`) before `buildTodaySnapshot` — so NEXT/NOW, the TODAY timeline, UPCOMING (grouped by day) and CONFLICTS all include device-calendar events once connected. Today renders the connect card when not granted and the one-time modal; pull-to-refresh also refreshes the device calendar.
- [x] `RecordSource += 'device_calendar'`; `CalendarEvent.isAllDay?`; `toDomainEvent` adapter (namespaced `cal:` id); `EventListItem` renders device events read-only (no detail route) + "All day" label; `buildTodaySnapshot`/`detectConflicts` exclude all-day from NEXT/current/conflicts. `database.ts` row types pinned to the DB's real `source` values.
- [x] **Tests:** `calendar-normalizer.test.ts` (normalization + safe fallbacks, today/upcoming ranges, sorting, today filter incl. midnight-spanning + all-day, `toDomainEvent`); `calendar-service.test.ts` (mocked `expo-calendar`: normalize + filter + sort, no-calendars → `[]`, skips broken events, query range) — 28 tests together; all-day cases in `conflicts.test.ts` / `todaySnapshot.test.ts`. 156 tests total; `npx tsc --noEmit` / `npx eslint .` / `npx expo export --platform ios` / `npx expo start` all clean after the wiring.
- [x] No calendar writes anywhere; Supabase untouched
- [ ] **Not yet extended to the Calendar tab** — it still shows only local/manual events (21-day window); the device calendar's upcoming window is hardcoded to 7 days in the hook, so merging there needs a configurable window first. Today is the only screen that shows device events for now.
- [x] **CocoaPods unblocked (2026-09-11)** — installed a portable Ruby 3.4.5 (Homebrew's own bootstrap bottle, no Homebrew needed) + CocoaPods 1.17.0 into `~/.portable-ruby` / `~/.cocoapods-gems` (user-space, no sudo); PATH also added to `~/.zshenv`. `npx expo prebuild --clean --platform ios` + `pod install` now succeed; `ExpoCalendar` pod resolves correctly.
- [x] **First real dev-build verification (2026-09-11)** — downloaded the iOS 26.5 Simulator runtime, booted an iPhone 17 simulator, ran `npx expo run:ios`: builds, installs, and launches. Screenshot confirms the sign-in screen renders correctly (including the new "Forgot password?" link). `xcrun simctl privacy grant calendar` succeeds against the app's bundle id. No crash reports. **Full interactive click-through (sign in → Today → tap "Connect Calendar" → grant) could not be automated from here** — driving the Simulator's UI needs either `idb` (not installed) or AppleScript/System Events, which needs macOS Accessibility permission that this Terminal doesn't have; granting it is a one-time manual System Settings toggle only the user can do. The simulator is left booted and running the live dev build for manual testing right now.
- [ ] Manual device testing (sign in, connect calendar, grant permission, see real events) — ready to do now in the running Simulator; not yet done
- [ ] Known limitation: the `expo-calendar` config plugin also adds Android `WRITE_CALENDAR` (no opt-out); we never call a write API — documented in PROGRESS.md

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
