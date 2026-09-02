# wassupday — Phased Implementation Plan

The goal of V1: reliably answer **"What do I need to do today?"** — nothing more.
Build in dependency order, one phase at a time, tests green before advancing.

| # | Phase | Depends on | Ships |
| - | ----- | ---------- | ----- |
| 1 | Project setup | — | Runnable Expo app, architecture, Supabase client, env, tests wired |
| 2 | Database | 1 | Migrations for `profiles/events/tasks`, RLS, triggers, indexes |
| 3 | Authentication | 2 | Sign up / in / out, persistent session, auth-gated routing |
| 4 | Events CRUD | 3 | `services/events` + event screens, timezone-correct |
| 5 | Tasks CRUD | 3 | `services/tasks` + task screens, completion toggle |
| 6 | Today dashboard | 4, 5 | `buildTodaySnapshot()` + Today screen on real data |
| 7 | Conflict detection | 4, 6 | `detectConflicts()` pure fn, wired into Today + save flow |
| 8 | Widgets | 6, 7 | iOS + Android home widgets, iOS lock screen, shared snapshot |

## Principles

1. **Pure core, thin shell.** Conflict detection and the Today snapshot are pure
   functions over `(events, tasks, now)`. They have no Supabase, no React, no
   clock of their own. This makes them trivially testable and lets the native
   widgets (Phase 8) reuse the exact same logic.
2. **Layering:** `screen → feature hook → service → supabase`. UI never imports
   the Supabase client. Services own row⇄model mapping.
3. **Deterministic, not clever.** No AI anywhere in V1. Overlap is arithmetic.
4. **Test after every phase.** `npm run check` (typecheck + lint + test) must be
   green. Never start a phase with the previous one's tests failing.
5. **Document limitations honestly** in PROGRESS.md as they're discovered.

## Testing focus by phase (see TASKS.md for the checklist)

- **2:** RLS isolation — user A cannot see user B's rows.
- **4:** timezone round-trip; range filtering.
- **5:** completion toggle; overdue detection.
- **6:** current/next/upcoming selection; priority + overdue task ordering;
  empty states; **date rollover** (23:59 → 00:00).
- **7:** overlap / touching edges / nested / multiple / none.
- **8:** Today-snapshot serialization for the widget payload, independent of
  native UI.

## Deferred to future phases (NOT V1)

AI planner, timetable/image OCR, vision AI, Google Calendar / email sync, voice,
full personal agent, Cloudflare, teams/collaboration, recurring-event engine,
Kanban.
