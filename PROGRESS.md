# wassupday — Progress Log

Running record of what's built, key decisions, and honest platform limitations.
Newest phase on top.

---

## Password reset ✅ code (⏳ needs one live Supabase config push) (2026-09-11)

Added a standard forgot-password / reset-password flow to `Phase 3 —
Authentication` on top of the existing sign-up/sign-in/sign-out.

- **`services/auth.ts`** — three new functions: `requestPasswordReset(email)`
  (emails a link; always returns success — Supabase itself never reveals
  whether the address has an account, matching the project's no-enumeration
  rule), `exchangeRecoveryCode(code)` (turns the emailed link's code into a
  session), `updatePassword(newPassword)` (works on any current session,
  recovery or normal).
- **`lib/supabase.ts`** — switched `flowType` from the default `implicit` to
  `pkce`. Implicit flow puts tokens in the redirect URL's *fragment*, which
  React Native's deep-link handling doesn't reliably deliver; PKCE puts a
  `code` in the query string instead, which does. Purely additive — sign-in/
  sign-up/sign-out don't use redirect URLs and are unaffected.
- **`(auth)/forgot-password.tsx`** (new) — email in, generic "check your
  email" confirmation out, regardless of whether the account exists.
  **`(auth)/sign-in.tsx`** — added a "Forgot password?" link.
- **`reset-password.tsx`** (new, root-level — *not* inside `(app)` or
  `(auth)`) — lands the `wassupday://reset-password?code=...` deep link.
  Deliberately outside both `Stack.Protected` groups: exchanging the code
  creates a real session immediately (before the user has picked a new
  password), and if the screen were inside `(auth)` (guarded on `!session`) it
  would get yanked out from under the user the instant that happens. Flow:
  exchange the code → "set a new password" form → `updatePassword` →
  `router.replace('/(app)/(tabs)')`.
- **`supabase/config.toml`** — added `wassupday://*` and the exact
  `wassupday://reset-password` to `auth.additional_redirect_urls` (was only
  the bare `wassupday://`). **Not yet pushed to the live project** — this
  environment has no Supabase CLI login (`supabase projects list` returns
  Unauthorized, only the publishable key is available, never the access
  token/service-role key). Until someone runs `supabase config push` (or sets
  it in the dashboard under Authentication → URL Configuration) with real
  credentials, `resetPasswordForEmail`'s custom `redirectTo` will fail
  Supabase's allow-list check and the emailed link won't reach
  `reset-password.tsx` correctly.

### Verification

`npx tsc --noEmit` / `npx eslint .` / `npx jest` (156 tests) / `npm run
test:db` (9 RLS tests) all pass. Not yet tested against a real inbox — needs
the config push above, then a real password-reset email round trip.

### Dev-only test bypass (2026-09-11, same day)

Since the redirect-URL push above hasn't happened, a real emailed link can't
reach `reset-password.tsx` yet — so a `__DEV__`-gated shortcut was added to
exercise the screen anyway:

- **`(auth)/forgot-password.tsx`** — after "Send reset link", a dev-only
  "Simulate clicking the email link" button navigates straight to
  `/reset-password?dev=1`, skipping only the email round trip.
- **`(app)/(tabs)/profile.tsx`** — a dev-only "Test password reset screen"
  button does the same, but reachable *while already signed in* — this is
  the one that actually proves the write path: `reset-password.tsx`'s
  `dev=1` branch skips `exchangeRecoveryCode` (no real code exists) and goes
  straight to the "set a new password" form (labelled "DEV TEST MODE" so
  it's never mistaken for the real flow), which then calls the same
  `updatePassword` → `supabase.auth.updateUser` used by the real flow. Called
  from Profile, that runs against the real, current session, so it genuinely
  tests whether a password change persists in the live database — sign out
  and back in with the new password to confirm.
- Both buttons render `null` (not just visually hidden) when `__DEV__` is
  `false`, the standard React Native way of keeping something out of release
  builds — same pattern already used for `console.warn` calls elsewhere in
  the services.

### Next

- Push the `additional_redirect_urls` change to the live project (needs
  `supabase login` + `supabase config push`, or the dashboard) — then the dev
  bypasses above can be deleted and the real emailed link tested end-to-end.
- Optional follow-up: fold the Profile dev bypass into a real, permanent
  "Change password" entry once the dev-only framing isn't needed.

---

## Device calendar — wired into Today ⏳ device verification (2026-09-11)

The calendar feature's service/hook/UI layer (`services/calendar/*`,
`features/calendar/*`) already existed, built to spec, but had never actually
been connected to a screen — the demo-polish pass on 2026-09-10 had, correctly
for that pass, stripped all calendar wiring out of Today so the app would run
cleanly in Expo Go. This entry reconnects it.

### What changed

- **`useTodaySnapshot`** now also calls `useDeviceCalendar()` and merges its
  `todayEvents` / `upcomingEvents` (via `toDomainEvent`) with the events from
  `event-source` before building the snapshot and the UPCOMING list. NEXT/NOW,
  the TODAY timeline, UPCOMING and CONFLICTS all treat device-calendar and
  local/manual events uniformly, exactly like the merge design in the
  original Feature-1 build. The composed `refetch` also calls
  `calendar.refresh()`, so pull-to-refresh updates both sources.
- **Today screen** — renders `CalendarConnectCard` inline whenever
  `calendar.status !== 'granted'` (including the Expo Go "needs a development
  build" message, now shown honestly since this is the calendar work), plus a
  `CalendarPermissionModal` shown once per session the first time the
  permission check resolves to non-granted (a `useRef` flag, not shown again
  after dismiss/connect — the inline card remains the re-entry point).
- Verified against the current SDK 57 docs (`getCalendarPermissions` /
  `requestCalendarPermissions` / `getCalendars(entityType)` /
  `listEvents(calendars, start, end)`, no Expo Go support) — the existing
  `calendar-service.ts` / `calendar-permissions.ts` already matched exactly;
  no API changes needed.

### Known gap — not yet done

- The **Calendar tab** still shows only local/manual events. Its window is 21
  days; `useDeviceCalendar`'s upcoming window is hardcoded to 7. Merging
  device events there cleanly needs a configurable window on the hook first —
  small, but deliberately not done in this pass to keep it scoped to Today.
- ~~No on-device or dev-build verification is possible in this environment~~
  **Resolved same day** — see the CocoaPods fix below. `npx expo run:ios` now
  builds, installs and launches on an iOS Simulator here.

### CocoaPods unblocked, dev build running (later the same day, 2026-09-11)

The local blocker from the demo-polish pass (`npx expo run:ios` needs
CocoaPods → needs Ruby ≥ 3.1 → system Ruby here is 2.6.10, no Homebrew) is
fixed, without installing Homebrew or touching the system Ruby:

- Downloaded Homebrew's own **portable Ruby** bottle (the prebuilt, relocatable
  Ruby Homebrew uses to bootstrap itself on machines with no Ruby) —
  `portable-ruby-3.4.5.arm64_big_sur.bottle.tar.gz` from
  `Homebrew/homebrew-portable-ruby`'s GitHub releases — into `~/.portable-ruby`.
  No compiling, no sudo.
  `~/.cocoapods-gems` (`GEM_HOME`) with that Ruby: `gem install cocoapods` → **1.17.0**, clean.
  Added to `~/.zshenv` (marked, appended block) so the user's own terminal
  picks up `pod`/`ruby` too.
- `npx expo prebuild --clean --platform ios` then resolves `ExpoCalendar`
  and finishes `pod install` successfully — verified in `ios/Podfile.lock`
  and the regenerated `Info.plist`'s `NSCalendars*UsageDescription` keys.
- No iOS Simulator runtime was installed at all (only visionOS) — ran
  `xcodebuild -downloadPlatform iOS` (8.52 GB, iOS 26.5), created an iPhone 17
  simulator, booted it.
- `npx expo run:ios --device <udid>` — **builds, installs
  (`com.wassupday.app`), and launches.** Screenshot confirms the sign-in
  screen renders correctly, including the same-day "Forgot password?" link
  (Metro was serving live, current source). No crash reports. `xcrun simctl
  privacy grant calendar com.wassupday.app` succeeds against the installed
  app.

**Still not done: an actual interactive walkthrough** (sign in, tap "Connect
Calendar", grant the OS prompt, see real device events merged into Today).
Driving the Simulator's UI from here needs either `idb` (not installed) or
AppleScript/System Events, which needs macOS Accessibility permission this
Terminal doesn't have — a one-time System Settings toggle only the user can
grant. The simulator was left booted, running the live dev build, ready for
either the user to test by hand right now, or for a follow-up session with
that permission granted.

### Next

- Manual click-through in the now-running Simulator: sign in (or sign up),
  tap "Connect Calendar", grant access, confirm real device events show up
  merged into NEXT/TODAY/UPCOMING/CONFLICTS.
- Optional follow-up: extend the Calendar tab to include device events (needs
  the configurable-window change above).

---

## Demo polish pass — Expo Go, local data source ✅ (2026-09-10)

Goal: make the existing prototype coherent and demo-ready **in Expo Go** — no
dev build, no device calendar. Opening the app should immediately answer "what's
up today?" with realistic content.

### What changed

- **Single local data source** — `src/services/demo/`:
  - `demo-seed.ts` — pure builders (`buildDemoEvents(now)`, `buildDemoTasks(now)`),
    everything anchored to `now` so a current event, a next event, an overdue
    task, a completed task and a deliberate schedule conflict always exist
    whenever the demo runs.
  - `demo-store.ts` — in-memory state, lazily seeded once per app session;
    `resetDemoStore()` for tests.
  - `demo-events.ts` / `demo-tasks.ts` — the same function surface as the real
    `services/events.ts` / `services/tasks.ts`, backed by the store.
- **Swap points** — `src/services/event-source.ts` and `src/services/task-source.ts`.
  Every hook and screen imports CRUD from these, never from `services/events`
  or `services/tasks` directly. Switching the demo for the real Supabase backend
  (or, later, a device-calendar source) is a one-line re-export change in each
  façade. The Supabase services and their tests are unchanged.
- **Shared validation** — extracted `ServiceResult`, `EventInput`, `TaskInput`,
  `validateEventInput`, `validateTaskInput` into `src/services/shared.ts` (pure,
  no `@/lib/supabase` import). Both the real services and the demo services
  import from it, so a test that touches the demo layer no longer transitively
  pulls in the Supabase client / AsyncStorage native module.
- **Today screen** — removed every calendar-permission surface (the
  "needs a development build" modal, the connect card) from the Today path; it
  no longer imports `@/services/calendar` at all. NEXT/NOW card, TODAY timeline,
  UPCOMING (now fed by the event source over the next 4 days, previously always
  empty in Expo Go), TASKS, and CONFLICTS are all populated. Personalised
  greeting from the auth display name. Pull-to-refresh.
- **Realistic seed** — NUS-flavoured: CS1231S lecture (current), Team Meeting ×
  MA1521 Consultation (overlapping → CONFLICTS), gym, problem-set block,
  CS2040S tutorial + GEA1000 project work tomorrow, MA1521 midterm in two days;
  tasks: CS1231S Assignment 3 (due tonight, high), MA1521 tutorial prep,
  CS2040S Lab 2 (overdue), email Prof. Tan, book a study room, plus one
  completed reading task.

### Key decisions

- **Demo source is the default in the committed code.** The app runs with zero
  backend setup. Flipping `event-source.ts` / `task-source.ts` back to Supabase
  is the documented path to real data.
- **Calendar feature code kept in tree** (`services/calendar/*`,
  `features/calendar/*`) — unused by the demo, untouched, ready for the device
  calendar phase. Nothing about that phase was started.
- **Auth kept as-is** — no demo bypass. A fresh demo still signs up (or signs
  in); the greeting needs the display name.

### Limitations

- Demo mutations (add/edit/delete/complete) are **in-memory** — they reset when
  the JS bundle reloads. Fine for a demo; optional AsyncStorage persistence is
  noted in TASKS.md.
- No device/simulator in this environment — gesture feel, modal transitions and
  the "+" Alert chooser are verified by code inspection, not a live run.

### Verification

`npx tsc --noEmit` ✅ · `npx eslint .` ✅ · `npx jest` — 11 suites, 156 tests ✅ ·
`npm run test:db` — 9 RLS tests ✅ · `npx expo export --platform ios` — bundles
clean (3.6 MB) ✅ · `npx expo start` — Metro boots, no resolution errors ✅ ·
`npx expo-doctor` — 20/21 (only the CocoaPods-version check fails; irrelevant to
Expo Go).

### Next

- Device calendar integration phase (see "Feature 1" below — code scaffolded,
  needs a dev build + on-device testing).

---

## Feature 1 — Device Calendar Integration (read-only) ✅ code / ⏳ device verification (2026-09-07)

Connect the OS Calendar app and show today's + upcoming events on the Today
screen. Read-only — no writes, no event creation in the device calendar, no
two-way sync. Supabase is untouched; the device calendar is the source of truth
for this feature.

### API / build

- `expo-calendar@57.0.3` (SDK-matched). Using the **SDK 57 object-oriented
  ("next") API** which is the default export: `requestCalendarPermissions()` /
  `getCalendarPermissions()`, `getCalendars(EntityTypes.EVENT)`,
  `listEvents(calendarIds, from, to)`.
- **`expo-calendar` is `require`d lazily** (`services/calendar/native.ts`), not
  statically imported. Reason: `expo-calendar`'s main entry re-exports enums
  from its `/legacy` submodule, which does `requireNativeModule('ExpoCalendar')`
  at import time — that throws in Expo Go and would crash the app on launch. No
  runtime module in the Today-screen graph touches `expo-calendar` now except
  behind the `IS_EXPO_GO` guard.
- No `isAvailableAsync` / device-availability check — it lives only in the
  unsafe `/legacy` path, and on a real iOS/Android dev build the calendar is
  always available. "Not available" collapses to the Expo Go case.
- **iOS 17+ has no read-only permission tier** — reading events requires *Full
  Access*. We request full access (never write-only) and simply never call a
  write API. The permission copy still tells the user we only read.
- **Development build required.** `expo-calendar` is a native module, not in
  Expo Go. `npx expo prebuild` + `npx expo run:ios|android` (or EAS Build).
  This is the project's first hard dev-build requirement (secure-store +
  datetimepicker plugins already leaned that way).
- **Known limitation:** the `expo-calendar` config plugin unconditionally adds
  Android `WRITE_CALENDAR` alongside `READ_CALENDAR` — there is no opt-out flag
  in `57.0.2`. We never call any write API; if the store listing needs it gone,
  a tiny custom config-plugin can strip the manifest entry later. Not done now.
- On iOS the plugin adds `NSCalendarsUsageDescription` +
  `NSCalendarsFullAccessUsageDescription`, both set to our read-focused string
  via the `calendarPermission` option.

### Architecture

```
services/calendar/
  types.ts               DeviceCalendarEvent / DeviceCalendar / CalendarPermissionState
  native.ts              lazy require() of expo-calendar (Expo-Go-safe)
  calendar-permissions.ts  getPermissionState / requestPermission / openCalendarSettings
  calendar-normalizer.ts   PURE: normalizeEvent, normalizeCalendar, localDayRange,
                           upcomingRange, sortByStart, filterTodayEvents,
                           filterUpcomingEvents, toDomainEvent
  calendar-service.ts      impure orchestration: getEventCalendars,
                           getTodayEvents, getUpcomingEvents
  index.ts                 public barrel
features/calendar/
  use-device-calendar.ts        permission state (+ Expo Go detection), today/upcoming reads, refresh triggers
  calendar-permission-content.tsx  shared prompt body (ask / blocked / expo-go)
  calendar-connect-card.tsx        inline card (persistent re-entry point)
  calendar-permission-modal.tsx    centered popup shown once on entering Today
```

- **Raw `expo-calendar` objects never leave the service** — `normalizeEvent`
  turns them into the plain `DeviceCalendarEvent` model (spec §6). Missing
  title → "Untitled event"; blank location/notes → `null`; unparseable dates →
  the event is dropped, not crashed on.
- Named it `DeviceCalendarEvent`, **not** `CalendarEvent` as the spec suggested,
  to avoid colliding with the existing in-app domain `CalendarEvent`. A thin
  `toDomainEvent()` adapter bridges the two (id namespaced `cal:<id>`,
  `source: 'device_calendar'`) so the Today dashboard treats calendar + in-app
  events uniformly and reuses `buildTodaySnapshot` / `detectConflicts` rather
  than duplicating current/next/conflict logic.
- `RecordSource` gained `'device_calendar'`; `CalendarEvent` gained an optional
  `isAllDay?`. `buildTodaySnapshot` and `detectConflicts` now exclude all-day
  events from NEXT/current/conflict logic (an all-day "Reading Week" isn't
  "happening now" and doesn't clash with your 10:00 meeting) — they still show
  in the timeline. `database.ts` row `source` types were pinned to the DB's
  actual CHECK values (`manual|import|ai`) so the wider domain union can't
  imply a bad insert.

### Permission UX (spec §4)

- Nothing prompts on mount. `useDeviceCalendar` reads the *current* status
  silently via `getCalendarPermissions()`; if already granted, it loads.
- **A centered popup** (`CalendarPermissionModal`) appears once on entering the
  Today screen while access isn't granted: explanation + "Connect Calendar"
  (the only thing that triggers the OS prompt) + "Not now" / tap-outside to
  dismiss. The **inline `CalendarConnectCard`** stays below as the persistent
  re-entry point after dismissal. Both share `calendar-permission-content.tsx`.
  The modal auto-opens only once per app launch (the Today screen stays mounted
  across tab switches; dismissal is tracked in screen state).
- Denied + `canAskAgain === false` → "Calendar access is turned off" +
  "Open Settings" (`app-settings:` on iOS, `Linking.openSettings()` on Android).
  No automatic re-prompting.
- **Expo Go:** `expo-calendar` is not in Expo Go, so `useDeviceCalendar`
  detects it (`Constants.executionEnvironment === StoreClient`) up front, never
  loads or calls the native module, and the prompt shows "Calendar needs a
  development build" instead of a broken connect flow. The rest of the app is
  fully usable in Expo Go.

### Refresh (spec §13)

`useDeviceCalendar` refreshes: on first grant, on tab focus (`useFocusEffect`),
on pull-to-refresh (`RefreshControl` on the Today `ScrollView`), and on
`AppState` → `active` (came back from the Calendar app). Race-guarded with an
`inFlightRef` — concurrent requests are dropped, the running read's fresh data
covers them.

### Verification

| Check | Result |
| --- | --- |
| `npm test` | ✅ 148 passing (calendar-normalizer 22, calendar-service 6, + all-day cases) |
| `npm run test:db` | ✅ 9 |
| `npm run typecheck` / `lint` | ✅ |
| `npx expo-doctor` | ✅ 21/21 (`expo-calendar` plugin validates) |
| `expo export` (iOS) | ✅ 1307 modules (`expo-calendar` + `/legacy` resolve) |
| `expo start` | ✅ Metro serves |

**Not verified here:** anything that needs the native module — the OS permission
prompt, real event reads, all-day/recurring/midnight-spanning rendering,
timezone behavior on a device in a different zone, the AppState-foreground
refresh. Requires a dev build on a real device/simulator (spec §17). The pure
date/normalization logic and the service orchestration (mocked native layer)
are unit-tested; the rest is a manual device pass.

### Deferred

- Merging device + in-app events is done for the Today screen; the Calendar tab
  still shows in-app events only — unifying it is a small follow-up.
- Per-calendar selection UI (spec §7 says architect for it, don't build it):
  `calendarId` is preserved on every `DeviceCalendarEvent`, so a filter is a
  later add.
- Opening a device event in the OS Calendar app on tap (currently read-only,
  non-interactive rows).

---

## Phase 5 + 6 + 7 — Tasks CRUD, Today dashboard, Conflict detection ✅ (2026-09-05)

Built together: the Today dashboard's `conflicts` field would otherwise stay
permanently empty without conflict detection, so Phase 7 landed alongside
Phase 6 rather than after it. Calendar sync (Apple Calendar / device calendar
via `expo-calendar`) was scoped out of this pass — researched and deferred as
a fast-follow (see "Calendar sync research" below): "Notion Calendar" turned
out to have no public API at all (it's a client for Google/iCloud/Outlook,
not a separate data source), and the realistic path (`expo-calendar`) needs a
development build, unlike everything else here which still runs in Expo Go.

### Tasks CRUD

- `services/tasks.ts` mirrors `services/events.ts` exactly: `ServiceResult<T>`,
  never sends `user_id`; also never sends `status`/`source` on create/update —
  status changes go exclusively through a narrow `setTaskStatus(id, status)`
  (payload is *only* `{ status }`), so quick-complete can't accidentally
  smuggle other field edits. `validateTaskInput` mirrors the `tasks` CHECK
  constraints (title 1–200, description ≤2000, `estimatedDuration` 1–1440,
  due date must parse).
- **Two list queries, not a date-filtered one**: `listActiveTasks()` (status
  only) / `listCompletedTasks()`. All date-relative bucketing lives in the new
  `lib/taskBuckets.ts` — pure, `now` as a parameter, unit-tested without a DB —
  and is shared by both the Tasks tab and the Today dashboard.
- `features/tasks/use-tasks.ts` mirrors `use-events.ts`'s pub/sub-plus-fetch
  shape (`notifyTasksChanged()`). `task-list-item.tsx`'s quick-complete uses a
  transient optimistic override, reset **during render** (not in a `useEffect`)
  when `task.status` itself changes — the React-documented way to "adjust
  state when a prop changes" without an extra render-triggering effect.
- Screens: Tasks tab (Today/Upcoming/Completed, matching the spec's 3
  sections — no separate "Overdue" section invented), `task/new`,
  `task/[id]/edit` (no separate detail screen — a task card shows everything
  inline, unlike events which need one for location/notes/category).
- The "+" tab now shows an `Alert.alert` chooser (Add Event / Add Task)
  instead of hard-navigating to `/event/new`. A route-based chooser was
  considered and rejected: naming it `add.tsx` would collide with the
  existing `(tabs)/add.tsx` no-op tab screen, since route groups don't add a
  URL segment — both would resolve to `/add`.

### Today dashboard

- `lib/todaySnapshot.ts`: `buildTodaySnapshot(events, tasks, now)` does its
  **own** day-boundary filtering from `now` (callers may pass a wider window)
  — this is what makes date rollover testable at all: the same fixtures,
  evaluated at `23:59` vs `00:01` the next day, produce different (correct)
  snapshots, with no fake timers. `overdueTasks` and `priorityTasks` are
  mutually exclusive (a task already counted as overdue is never also
  "priority") so nothing double-counts across the two Today sections.
- `features/today/use-today-snapshot.ts` composes the existing
  `useDayEvents`/`useActiveTasks` hooks — no direct Supabase access. Also
  returns the raw today-event list alongside `snapshot`: `TodaySnapshot` has
  no "full day" field by design (kept lean for the future widget payload), but
  the dashboard's TODAY timeline needs the whole day, past events included —
  a hook-level convenience, not a widening of the shared type.
- **Date-transition handling**: `useFocusEffect` refetch (covers "reopened
  after being away") plus a 60-second `setInterval` that only *compares* the
  local date key and updates it on mismatch — not a per-second ticker.
  Documented, deliberate trade-off: `currentEvent`/`nextEvent`/relative-time
  text are only as fresh as the last focus/refetch/rollover-check, not
  continuously live — acceptable for a calm planner, not a stopwatch.
- Hit a real `useFocusEffect` footgun while building this: an *unmemoized*
  composed `refetch()` (a plain function closing over other hooks' results)
  gets a new identity every render; passed to `useFocusEffect`, that can
  refire on every re-render the refetch itself causes — a runaway refetch
  loop. Fixed by building `refetch` with `useCallback` depending on the
  *already-stable* inner `refetch`s (`dayEvents.refetch`, `activeTasks.refetch`
  — real `useCallback`s with fixed deps), not the whole (always-fresh) hook
  return objects. Applied the same fix to `useTaskSections`'s composed
  `refetch` in `features/tasks/use-tasks.ts`.
- Today screen rewritten in spec order: greeting/date → NEXT (current event,
  or next with a countdown) → TODAY timeline (`EventListItem`, unchanged) →
  TASKS (overdue then priority, `TaskListItem`) → CONFLICTS (rendered only
  when non-empty — no placeholder when clear, matching "unobtrusive").

### Conflict detection

- `lib/conflicts.ts`: `detectConflicts(events)`, strict overlap
  (`a.start < b.end && a.end > b.start` — touching edges are not a conflict,
  consistent with `listEventsInRange`'s existing half-open-interval
  convention). Sorts by start time and scans with an early break once a later
  event starts at/after the current one's end, instead of a blind O(n²).
- Wired into the event save flow two ways: passively (already free — save
  already calls `notifyEventsChanged()`, and Today's focus-refetch recomputes
  conflicts for real the moment the user returns) and actively
  (`event-form.tsx` gained an optional `excludeEventId` prop and a debounced,
  non-blocking effect that checks the draft against other same-day events and
  shows a one-line danger-colored hint — never blocks save).

### Verification

| Check | Result |
| --- | --- |
| `npm test` (jest) | ✅ 118 passing |
| `npm run test:db` (PGlite RLS) | ✅ 9 passing (schema untouched — no new migration needed) |
| `npm run typecheck` / `lint` | ✅ |
| `npx expo-doctor` | ✅ 21/21 |
| `expo export` (iOS) | ✅ 1292 modules |

**No device/simulator available in this environment** — runtime UI (the "+"
chooser, quick-complete feel, modal transitions, visual check of the calm
styling) was not exercised live; that remains an open manual-verification item
in `TASKS.md`, same as Phases 3–4.

### Calendar sync research (not built — deferred)

- `expo-calendar` (device Calendar app — covers Apple Calendar and anything
  synced into it, e.g. a Google account added in iOS Settings) is the correct
  path, version `57.0.2` for this SDK. **Requires a development build** — does
  not work in Expo Go. iOS 17+ has no read-only permission tier (Full Access
  only). No incremental sync — must re-fetch a date range each time.
- "Notion Calendar" has **no public API** for third parties — it's a client
  app with no separate event data of its own, so it isn't integrable as such.
- Plan when this is picked up: `expo-calendar` + config plugin → a
  `services/calendar-sync.ts` that reads a date range and upserts into the
  existing `events` table with `source: 'import'` (already modeled in
  `RecordSource`) — reuses every existing Today/Calendar screen unchanged.
  Will need a schema addition (an `external_id` column) for idempotent
  re-syncing, and a real device/dev-build to verify at all.

---

## Moved back to Expo SDK 57 (2026-09-04)

Re-scaffolded the base template against `expo-template-default@sdk-57` (the
same one used the first time we were on 57 — see "Phase 1" below) and ported
every dependency + the app code onto it. Reverses the earlier "back to sdk54"
move; SDK 54 → 57 is where the project stays now.

**Dependency deltas** (base template + our additions, all re-pinned via
`npx expo install --fix`): `expo` 54.0.37→57.0.20, `react-native` 0.81.5→0.86.3,
`react`/`react-dom` 19.1.0→19.2.3, `expo-router` 6.0.24→57.0.19, `typescript`
5.9.2→6.0.3, `jest-expo` 54.0.18→57.0.5, `eslint-config-expo` 10.0.0→57.0.2,
`@react-native-community/datetimepicker` 8.4.4→9.1.0 (the only extra dep `expo
install --fix` needed to bump).

**Code changes for the SDK 57 API surface:**

- `src/app/_layout.tsx`: `ThemeProvider` / `DarkTheme` / `DefaultTheme` now
  import from `expo-router` itself (SDK 57 re-exports them), not
  `@react-navigation/native` — dropped that dependency entirely, nothing else
  used it. Dropped the `import 'react-native-reanimated'` side-effect import
  too (not in the current template; nothing in the app calls reanimated
  directly).
- `app.json`: removed `newArchEnabled` again (still not a valid key on 57 — new
  arch is always on), and `android.edgeToEdgeEnabled` (same story — 57's config
  schema rejects it; edge-to-edge is the only behavior now). `expo-doctor`
  catches both.
- `src/hooks/use-theme.ts` needed **no change** this time — it was already
  written as `scheme === 'dark' ? 'dark' : 'light'`, which is correct under
  both SDKs' differing `useColorScheme()` return shapes.
- `eslint-config-expo@57` enables `react-hooks/set-state-in-effect`, which
  10.0.0 (SDK 54's version) didn't. Fixed three real hits, all the same shape
  — a `setState` call that kicks off an effect's async work (data-fetching
  "start loading" flags in `features/events/use-events.ts`, and the
  hydration-safe pattern in `hooks/use-color-scheme.web.ts`) — with scoped
  `eslint-disable-next-line` comments explaining why each is intentional.
- `event-form.tsx`: the React Compiler plugin (also newly linted here) flagged
  `useMemo(() => ({ start: ...new Date()... }), deps)` as unsafely memoized —
  `new Date()` inside a memo callback is impure. Replaced with two `useState`
  lazy initializers (`defaultStart` / `defaultEnd`), which only need to run
  once at mount anyway; no memo needed.

**Verification:** `npm run check` green (64 jest + 9 RLS tests, typecheck,
lint), `expo-doctor` clean, `expo export` bundles, `expo start` serves, router
types regenerate with no stale routes.

---

## Auth simplified: dropped email confirmation (2026-09-04)

**Decision:** the hosted Supabase project's confirmation email uses a magic
link by default — `config.toml`'s `{{ .Token }}` template only applied to a
local (`supabase start`) instance, not the linked hosted project. Rather than
wire up a deep-link callback for the link, or push a custom hosted email
template, we turned email confirmation **off**. `signUp` now returns a session
immediately; there is no verification step.

**What changed:**

- `supabase/config.toml`: `enable_confirmations = false`.
- Pushed to the **live** project with `supabase link --project-ref
  rdxeorgntcbmisltcbgt && supabase config push` (the CLI was already logged
  in). Verified after push via `GET /auth/v1/settings`:
  `mailer_autoconfirm: true`. This push also applied the rest of the auth
  section we'd already set for this project: `minimum_password_length = 10`,
  `password_requirements = "letters_digits"`, `site_url = "wassupday://"`,
  `additional_redirect_urls = ["wassupday://"]`, TOTP MFA enrollment off
  (unused). Nothing outside `[auth]` was touched (db/api/storage reported
  "up to date").
- `src/services/auth.ts`: removed `verifyEmailOtp` / `resendVerification`;
  `signUp` fails if Supabase ever returns no session (defensive — should not
  happen with confirmations off). `AuthOutcome` simplified to
  `{ ok: true } | { ok: false; message }`.
- `src/lib/validation.ts`: removed `validateOtp` / `normalizeOtp` (unused now).
- Deleted `src/app/(auth)/verify.tsx` and `supabase/templates/confirmation.html`.
- `sign-up.tsx` / `sign-in.tsx`: no more `needsVerification` branch — success
  just returns; `Stack.Protected` swaps the navigator once the session lands.
- `scripts/smoke.mjs`: no longer waits for a pasted code.
- Tests updated to match (`auth.test.ts`, `validation.test.ts`).

**Trade-off, stated honestly:** without confirmation, `signUp` also tells the
caller directly when an email is already registered ("User already
registered") — the account-enumeration protection that a confirmation step
provides is gone. Anyone can also sign up with an email they don't own (mail
delivery was never proven). This was an explicit, informed choice, not an
oversight — flagging it here in case a later phase (password reset, an "add
this email to receive reminders" feature) needs confirmed ownership after all.

**Verification:** `npm run check` green (64 jest + 9 RLS tests, typecheck,
lint); `expo export` bundles (1459 modules); router types regenerated cleanly
(no dangling `/verify` route).

---

## Phase 4 — Events CRUD ✅ (2026-09-04)

Supabase project is now live (`.env.local` filled in). Confirmed via REST:
tables exist, `anon` gets `permission denied` (RLS working), email confirmation
is ON.

### Data layer — `src/services/events.ts`

- `listEventsInRange`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`.
- `rowToEvent` maps `snake_case` rows → `camelCase` domain models; UI never sees
  a DB row shape.
- `user_id` is **never** sent from the client (DB `default auth.uid()` + RLS
  `WITH CHECK`). Tests assert the insert/update payloads contain no `user_id`.
- `validateEventInput` mirrors the DB CHECK constraints (title 1–200, notes
  ≤2000, location ≤200, `end >= start`) so bad input fails fast with a friendly
  message before the round-trip.
- Range query is a true overlap: `start_time < to AND end_time > from`.

### Hooks — `src/features/events/use-events.ts`

No data-fetching library. Each hook fetches on mount + exposes `refetch`;
screens call it from `useFocusEffect`; a tiny module-level pub/sub
(`notifyEventsChanged`) refreshes open lists after a mutation. `useDayEvents`,
`useUpcomingEvents(days)`, `useEvent(id)`.

### Navigation

`(app)` is now a Stack containing the bottom tabs + the event screens:

```
(app)/_layout.tsx            Stack: (tabs) + event/new (modal) + event/[id] + event/[id]/edit (modal)
(app)/(tabs)/_layout.tsx     Tabs: Today | Calendar | + | Tasks | Profile
(app)/(tabs)/index.tsx       Today — greeting/date + today's events (full dashboard = Phase 6)
(app)/(tabs)/calendar.tsx    SectionList grouped by day (Today / Tomorrow / date), + button
(app)/(tabs)/tasks.tsx       placeholder (Phase 5)
(app)/(tabs)/profile.tsx     display name + email + sign out
(app)/(tabs)/add.tsx         never renders — tabPress is intercepted to open /event/new
(app)/event/new.tsx          EventForm -> createEvent
(app)/event/[id].tsx         detail view, header "Edit"
(app)/event/[id]/edit.tsx    EventForm -> updateEvent / deleteEvent (confirm Alert)
```

The centre "+" tab intercepts `tabPress` and pushes the new-event modal (the
Add-Event / Add-Task chooser lands in Phase 5 when tasks exist).

### New shared UI

`components/{screen,text-field,primary-button,datetime-field,states}.tsx`,
`features/events/{event-form,event-list-item}.tsx`. Date/time editing uses
`@react-native-community/datetimepicker` (Expo-supported native picker).

### Fix worth noting

The hand-written `src/types/database.ts` didn't satisfy supabase-js's
`GenericSchema` — the client silently degraded `.insert()`/`.update()` args to
`never`. Two causes: (1) each table entry needs a `Relationships` key;
(2) row types must be `type` aliases, not `interface` (interfaces lack the
implicit index signature `Record<string, unknown>` wants). Fixed; `Insert`
types now leave DB-defaulted columns optional.

### Verification

| Check | Result |
| --- | --- |
| `npm test` | ✅ 74 (time 24, validation 29, auth 12, events 9) |
| `npm run test:db` | ✅ 9 |
| `npm run typecheck` / `lint` | ✅ |
| `npx expo-doctor` | ✅ 18/18 |
| `expo export` (iOS) | ✅ 1460 modules |

### Not done

- **Live simulator / device run** — not possible here. `scripts/smoke.mjs` does
  a full real round-trip (signup → paste OTP → verify → create/list/RLS/delete);
  run it once with a real email.
- Recurring events — out of V1 scope.

---

## Phase 2 + 3 — Database schema & Authentication ✅ (2026-09-04)

> **Superseded:** the OTP email-verification flow described below was replaced
> the same day — see "Auth simplified: dropped email confirmation" above.
> Schema, RLS and everything else in this entry is still current.

### Schema (`supabase/migrations/20260904000100_init_schema.sql`)

- `profiles` (PK = `auth.users.id`, `on delete cascade`), `events`, `tasks`.
- Enum-like columns are `text` + `CHECK (… in (…))` rather than PG enums — same
  injection safety (bad value is rejected), far easier to evolve by migration.
- `events` has `CHECK (end_time >= start_time)`; `tasks.estimated_duration` is
  bounded 1–1440.
- `set_updated_at()` trigger on all three; `handle_new_user()` creates the
  profile row from `raw_user_meta_data` on `auth.users` insert.
- Indexes for the Today queries: `events(user_id, start_time)`,
  `tasks(user_id, status, due_date)`, `tasks(user_id, due_date)`.

### Security model (the "no injection is bypassable" requirement)

1. **RLS on every table**, no exceptions. Every policy is `to authenticated`
   and keyed on `(select auth.uid()) = user_id` (`= id` for profiles).
2. **`anon` is granted nothing** — `revoke all … from anon` + no anon policy, so
   a token-less request gets `permission denied`, not an empty set.
3. **Forged `user_id` can't get through** — column defaults to `auth.uid()` and
   the INSERT policy's `WITH CHECK` re-verifies it. Proven by test.
4. **SECURITY DEFINER functions** pin `search_path = ''` and schema-qualify
   every name — closes the classic privilege-escalation vector.
5. **No SQL is ever string-built** in the app. All reads/writes go through
   supabase-js / PostgREST (parameterized). Client input is additionally run
   through allow-list validators in `lib/validation.ts` before it's sent.
6. Least-privilege grants: `authenticated` gets table DML only; row visibility
   is still RLS.

Verified by **`npm run test:db`** — 9 tests on an in-memory Postgres (PGlite)
that fakes Supabase's `auth` schema, applies the real migrations, then switches
Postgres roles + JWT claims exactly like a PostgREST request: cross-user
SELECT/UPDATE/DELETE isolation, forged `user_id`, `anon` lockout, `profiles`
INSERT denial, CHECK-constraint rejection. No Docker needed.

### Auth flow

Email + password, with a **6-digit email OTP** for first-time verification:

```
sign-up ─(signUp: display_name in metadata)─► unconfirmed user + OTP email
        └─► verify ─(verifyOtp type:'signup')─► session ► (app)
sign-in ─► if "Email not confirmed" ─► routed to verify (+ resend)
```

- `services/auth.ts` is the only caller of `supabase.auth.*`. Every entry point
  re-validates input, returns a plain discriminated result, and maps errors so
  nothing enables **account enumeration** (sign-up of an existing email looks
  identical to a new one; sign-in stays "Invalid login credentials").
- `lib/validation.ts` — pure allow-list validators: email (no control chars / no
  header-injection), password (≥10, letter+digit, **≤72 bytes** so bcrypt never
  silently truncates), OTP (`^\d{6}$`), display name (control-char strip, 60 cap
  matching the DB CHECK). 29 unit tests.
- `config.toml`: `enable_confirmations = true`, `minimum_password_length = 10`,
  `password_requirements = "letters_digits"`, `secure_password_change = true`,
  `[auth.email.template.confirmation]` → `templates/confirmation.html`
  (`{{ .Token }}`), signup email `max_frequency = "60s"`.

### Session persistence — "stay logged in until the app is deleted"

- Survives process kill / reboot: `persistSession` + `autoRefreshToken`, session
  stored **encrypted** (random AES-256 key in the Keychain via
  `expo-secure-store`, ciphertext in AsyncStorage — `LargeSecureStore`).
- Gone on reinstall: AsyncStorage (the ciphertext) is wiped with the app
  container. Belt-and-braces: the keychain item is
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no iCloud sync / device transfer) and
  `ensureFreshInstallPurge()` deletes any stale keychain entry on the first
  launch after an install (detected via an AsyncStorage marker).
- No idle/absolute session timeout is configured — a session ends only on
  explicit sign-out or app deletion, as required.

### Routing

`Stack.Protected` guards (Expo Router 6): `guard={!!session}` → `(app)`,
`guard={!session}` → `(auth)`. Splash screen is held (`preventAutoHideAsync`)
until `AuthProvider` reports the first session read, so there's no auth-state
flicker. New screens: `(auth)/sign-in|sign-up|verify`, `(app)/index`
(placeholder + sign-out).

### Files

- `supabase/migrations/20260904000100_init_schema.sql`, `supabase/config.toml`,
  `supabase/templates/confirmation.html`, `supabase/seed.sql`
- `supabase/tests/{db.ts,rls.test.ts,package.json}`
- `src/lib/validation.ts` (+ test), reworked `src/lib/supabase.ts`
- `src/services/auth.ts` (+ test)
- `src/features/auth/auth-context.tsx`
- `src/components/{screen,text-field,primary-button}.tsx`
- `src/app/_layout.tsx` (rewrite), `src/app/(auth)/*`, `src/app/(app)/*`

### Verification

| Check | Result |
| --- | --- |
| `npm test` (jest) | ✅ 51 passing (time 10, validation 29, auth 12) |
| `npm run test:db` (PGlite RLS) | ✅ 9 passing |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npx expo-doctor` | ✅ 18/18 |
| `expo export` (iOS) | ✅ bundles clean |
| `expo start` | ✅ |

### Blockers / notes

- **Docker isn't running in this environment**, so `supabase start` / a live
  end-to-end auth test (real OTP email) has not been run here. The RLS suite
  (PGlite) covers the schema; the auth flow is covered by mocked-client unit
  tests. Someone must do one manual pass against a real project — see TASKS.md.
- `config.toml` is written for a recent Supabase CLI (schema from
  `supabase init`, v2.x). `supabase config push` needs a CLI new enough to
  support it; otherwise set the same values in the dashboard (table in
  `supabase/README.md`).
- Added dev deps: `@electric-sql/pglite` (RLS tests). `node --test` runs the
  `supabase/tests` suite (Node ≥ 22 type-stripping).

---

## Phase 1 — Project setup ✅ (2026-09-02)

### What was done

- Scaffolded with `create-expo-app` (default template) → **Expo SDK 54**,
  React Native 0.81, React 19.1, TypeScript 5.9 (strict), Expo Router 6 with
  typed routes and React Compiler enabled.
  (Briefly trialled SDK 57; reverted to SDK 54 for stability/ecosystem maturity.)
- Trimmed the template's demo screens/components; kept `ThemedText`,
  `ThemedView`, color-scheme hooks.
- Reorganized into `src/` clean architecture (see README → Project structure).
- Renamed app identity to `wassupday` (`app.json`, bundle id `com.wassupday.app`).
- Added Supabase:
  - `@supabase/supabase-js` v2
  - Encrypted session persistence via `LargeSecureStore`
    (`expo-secure-store` holds a random AES key, AsyncStorage holds the
    ciphertext — works around SecureStore's ~2 KB limit). Pattern from the
    official Supabase + Expo guide.
  - `registerAuthAutoRefresh()` ties `startAutoRefresh` / `stopAutoRefresh` to
    `AppState`, called once from the root layout.
- `lib/env.ts` — validated access to the two `EXPO_PUBLIC_` Supabase vars, with
  a helpful error if unset. `.env.example` + git-ignored `.env.local`.
- `constants/theme.ts` — calm neutral palette + semantic colors
  (danger/warning/success/accent) for light and dark.
- `types/models.ts` (domain models incl. `TodaySnapshot`, `ScheduleConflict`)
  and `types/database.ts` (row shapes + typed `Database` for the client).
- `lib/time.ts` — pure, dependency-free date helpers, fully unit-tested.
- Jest via `jest-expo`; scripts: `test`, `test:watch`, `typecheck`, `lint`.
- `supabase/migrations/` created (empty — Phase 2).

### Verification

| Check                         | Result |
| ----------------------------- | ------ |
| `npm test`                    | ✅ 10 passing (`src/lib/time.test.ts`) |
| `npm run typecheck` (`tsc`)   | ✅ no errors |
| `npx expo-doctor`             | ✅ 21/21 |
| `npx expo lint`               | ✅ configured, no errors |
| iOS bundle (`expo export`)    | ✅ bundles clean |

### Architecture decisions

1. **`src/` root, `src/app/` for routes.** Expo Router auto-detects `src/app`.
   All feature code lives under `src/` too, so the SDK 54 template's root-level
   `app/ components/ hooks/` were consolidated under `src/`. (The build spec's
   suggested tree maps onto this.)
2. **Styling: themed primitives + `StyleSheet` design tokens, not NativeWind.**
   The spec allows "NativeWind or another appropriate styling approach."
   Tokens in `constants/theme.ts` + `ThemedText`/`ThemedView` give consistent
   light/dark theming with zero extra build config and no risk of a
   NativeWind/Metro/React-Compiler version clash. Revisit if the UI grows.
3. **Session storage: encrypted (SecureStore + AsyncStorage), not plain
   AsyncStorage.** Matches the current official Supabase guide and keeps tokens
   encrypted at rest. Costs three small deps (`aes-js`,
   `react-native-get-random-values`, `expo-secure-store`).
4. **Publishable/anon key in `EXPO_PUBLIC_`.** Correct by design — it's meant to
   be public; RLS (Phase 2) is the actual access control. The service-role key
   is never in the app.
5. **Domain models decoupled from DB rows.** `services/` will map between them so
   UI/business logic never depends on snake_case columns. Keeps conflict
   detection and the Today snapshot pure and reusable by widgets (Phase 8/11).
6. **`react-native-url-polyfill/auto`** imported in `supabase.ts` as low-risk
   insurance for `URL` usage inside `supabase-js`.

### Commands to run the project

```bash
npm install
cp .env.example .env.local     # then fill in Supabase URL + publishable key
npx expo start                 # or: npx expo start --ios | --android | --web
```

### Blockers / platform limitations discovered

- **SDK choice:** started on SDK 57, reverted to **SDK 54** — more mature
  ecosystem (Supabase, jest-expo, tooling all well-tested against it) and it is
  the current stable line most third-party libs target. Re-pinned every dep via
  `npx expo install --fix`.
- **Expo Go vs dev build:** `expo-secure-store` is a config plugin. Most of the
  app will still run in Expo Go, but a development build
  (`npx expo run:ios` / `run:android`) is the reliable path and will be
  **required** for the widgets in Phase 8.
- **No Supabase project wired yet** — `.env.local` holds placeholders. Nothing
  hits the network until Phase 3, so this doesn't block Phase 1/2 work, but
  `npm start` will show the env error screen until real values are set.
- Native `ios/` and `android/` folders are not generated (managed workflow);
  they'll be produced by `expo prebuild` / `expo run:*` when needed for Phase 8.

---

## Platform limitations (living list)

| Area | Limitation | Status |
| ---- | ---------- | ------ |
| Widgets | Require a development build; not available in Expo Go | Expected, Phase 8 |
| Android lock screen | Lock-screen widgets not consistently supported across OEMs/versions | Out of scope for V1 |
| Widget refresh | OS controls refresh cadence; no guaranteed exact-midnight update | Will document in Phase 8/12 |
| Auth | Email/password only in V1 (no OAuth providers) | By design |
