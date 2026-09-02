# wassupday — Progress Log

Running record of what's built, key decisions, and honest platform limitations.
Newest phase on top.

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
