# Implementation Plan: Workout Tracker

**Status:** In progress
**Owner:** hasyim.az@gmail.com
**Last updated:** 2026-08-09
**Related:** [PRD.md](./PRD.md), [TECH_STACK.md](./TECH_STACK.md)

This document breaks the v1 scope from the PRD into a sequence of small, independently deployable pull requests. Each PR is a thin vertical slice — it should merge to `main` cleanly, keep the app in a working (if incomplete) state, and be reviewable on its own. Later PRs build on earlier ones; the numbering is the intended build order, not a strict contract — reorder as real dependencies or priorities shift during implementation.

Post-v1 items (Strava OAuth, exercise how-to links, background timer alerts — see PRD Section 11) are intentionally excluded from this plan.

## How to read each entry

- **Depends on:** which earlier PR(s) must land first.
- **Contains:** what actually ships in the PR.
- **Deployable because:** why merging this to `main` doesn't break the app, even though the feature isn't "done" yet.
- **PRD ref:** the section(s) this PR implements.
- **Status:** added as PRs land, with a link to the actual GitHub PR(s). Absent = not started.

---

## Phase 0 — Foundation

### PR-01: Project scaffold & deploy pipeline

- **Depends on:** —
- **Contains:** Next.js (App Router) + TypeScript project init; Tailwind CSS + shadcn/ui base setup; ESLint/Prettier config; Vercel project connected with a deploy-on-push pipeline; a single placeholder home page.
- **Deployable because:** it's a working empty app — nothing to break.
- **PRD ref:** TECH_STACK.md Sections 2, 8.
- **Status:** ✅ Shipped — GitHub PR #3.

### PR-02: Database & Supabase connection

- **Depends on:** PR-01
- **Contains:** Supabase project provisioned; Prisma installed and connected; initial migration with just the `User` table (id, email, password hash, `unit_system`, `reminders_enabled`, `created_at`); a `/api/health` route that confirms DB connectivity.
- **Deployable because:** no UI depends on it yet; purely additive infrastructure.
- **PRD ref:** Section 9 (`User`); TECH_STACK.md Section 4.
- **Status:** ✅ Shipped — GitHub PR #4. Follow-up fix in PR #6: Vercel's Next.js framework preset doesn't honor a `vercel-build` package.json script (that convention doesn't apply to recognized framework presets) and Supabase's raw "direct connection" host is IPv6-only, unreachable from Vercel's build environment — fixed via a `vercel.json` `buildCommand` override pointed at Supabase's session pooler instead. See `.env.example` and `prisma.config.ts` for the corrected connection-string guidance.

### PR-03: Auth — sign up, log in, log out

- **Depends on:** PR-02
- **Contains:** Auth.js credentials provider; bcrypt password hashing; JWT session handling; signup/login/logout pages; middleware protecting authenticated routes; a minimal authenticated "dashboard" placeholder page to land on after login.
- **Deployable because:** it's a complete, working auth loop even with nothing behind it yet.
- **PRD ref:** 7.1 (auth bullets); Section 8 (security).
- **Status:** ✅ Shipped — GitHub PR #5. Config split into `auth.config.ts` (Edge-safe, no Prisma) + `auth.ts` (full config) since middleware runs on the Edge runtime and can't load Prisma's generated client.

### PR-04: Account settings & password reset

- **Depends on:** PR-03
- **Contains:** settings page with unit system toggle (Metric/Imperial, default Metric) and reminders on/off toggle (UI only — reminders themselves ship in PR-27/28); password reset flow (email + token).
- **Deployable because:** self-contained settings surface; reminders toggle is inert until PR-28 exists.
- **PRD ref:** 7.1 (account settings bullet).
- **Status:** 🚧 In review — GitHub PR #7, **scope reduced to just the settings page**. Password reset needs a transactional email provider (a new external service/account decision, same weight as choosing Vercel/Supabase) — deferred to a small follow-up PR once that's set up, rather than adding it silently.

---

## Phase 1 — Manual workout logging (no AI yet)

This phase proves out the hardest part of the data model — blocks, rounds, and three set types — without also depending on the LLM. Workouts are created ad-hoc/manually here; AI generation is layered on top starting in Phase 3.

### PR-05: Exercise library

- **Depends on:** PR-03
- **Contains:** `Exercise` table + migration; CRUD API and UI for a per-user exercise library (name, default muscle group, default set type); typeahead/select component for reuse in later PRs.
- **Deployable because:** a standalone library screen; nothing else references it yet.
- **PRD ref:** 7.4 (exercise library bullet); Section 9 (`Exercise`).
- **Status:** ✅ Shipped — GitHub PR #9. Typeahead/select component deferred: nothing consumes the exercise library yet (that starts in PR-07), so it was cut to keep this PR to what's actually needed now rather than guessing at requirements — will build it against PR-07's real usage instead.

### PR-06: Ad-hoc workout session shell

- **Depends on:** PR-05
- **Contains:** `WorkoutSession` table + migration (`status`: planned/in_progress/completed/discarded, `type`, `label`, notes fields); "Start ad-hoc workout" button that creates an empty in-progress session; session detail page (empty state); "Finish Workout" transition to `completed` with no feedback prompt yet.
- **Deployable because:** produces empty-but-real sessions end-to-end; safe no-op if unused.
- **PRD ref:** 7.4 (session creation, status transitions); Section 9 (`WorkoutSession`).
- **Status:** ✅ Shipped — GitHub PR #10. Fields beyond what this PR needs (`plan_id`, `template_id`, `focus_tags`, post-workout feedback fields) are deliberately not on the model yet — added by the PRs that actually use them (PR-16, PR-20, PR-21, PR-09), matching the additive-columns pattern used elsewhere in this plan. Editing (label/notes) and finishing are both guarded server-side to only affect `IN_PROGRESS` sessions owned by the requesting user, regardless of what the UI shows.

### PR-07: Blocks & exercises within a session

- **Depends on:** PR-06
- **Contains:** `WorkoutBlock` and `WorkoutExercise` tables + migrations; UI to add/remove/reorder blocks (round count, optional rest seconds) and add exercises from the library into a block, mid-session.
- **Deployable because:** an in-progress session can now hold structure even before sets are loggable.
- **PRD ref:** 7.4 (block structure, incl. all-duration circuits); Section 9 (`WorkoutBlock`, `WorkoutExercise`).
- **Status:** 🚧 In review — GitHub PR #11. `WorkoutExercise.exercise` uses `onDelete: Restrict` (an exercise in use by a workout can't be deleted), now that exercises are actually referenced elsewhere for the first time — surfaced in the exercise library UI as a clear error rather than an unhandled failure. Also ships the `ExercisePicker` typeahead deferred from PR-05, against its first real consumer.

### PR-08: Set logging (reps, duration, distance)

- **Depends on:** PR-07
- **Contains:** `Set` table + migration; logging UI for all three set types (reps+weight, duration, distance) per round; edit/delete; per-exercise "note for next time" field; new sets default to the account's unit system (PR-04).
- **Deployable because:** completes the core manual logging loop — a real workout can be fully logged.
- **PRD ref:** 7.4 (set types); Section 9 (`Set`).

### PR-09: Post-Workout Feedback

- **Depends on:** PR-08
- **Contains:** "Finish Workout" now prompts for the 1–5 difficulty rating, optional note, energy rating, and goal-for-next-workout note; persisted on the session.
- **Deployable because:** small, additive step at the end of an existing flow.
- **PRD ref:** 7.6; Section 9 (`WorkoutSession` feedback fields).

### PR-10: Workout History

- **Depends on:** PR-09
- **Contains:** chronological history list (strength sessions only at this point) with summary cards; full-detail view of any past session.
- **Deployable because:** pure read view over data that already exists.
- **PRD ref:** 7.8.

---

## Phase 2 — Make manual logging pleasant

### PR-11: In-Workout Timer

- **Depends on:** PR-08
- **Contains:** countdown timer for duration-based sets; automatic rest countdown tied to a block's `rest_seconds`; pause/skip controls; `Notification` + Wake Lock API integration, foreground-only.
- **Deployable because:** purely additive UI on the existing logging screen; no data model change.
- **PRD ref:** 7.5.

### PR-12: Today view

- **Depends on:** PR-06, PR-10
- **Contains:** "Today" landing view showing today's session if one exists (still manual/ad-hoc at this point) with a one-tap "Start Workout" entry point; empty state prompting an ad-hoc start.
- **Deployable because:** a new home screen wired to existing data; no new backend logic.
- **PRD ref:** 7.3 (Today view, ahead of AI-generated plans).

---

## Phase 3 — AI workout generation

### PR-13: Claude API client & structured output plumbing

- **Depends on:** PR-01
- **Contains:** thin Anthropic Claude client wrapper (timeout + single retry); Zod schemas for the workout-suggestion JSON shape; no user-facing surface yet.
- **Deployable because:** backend-only utility code, unused until PR-14 wires it in.
- **PRD ref:** Section 8 (AI cost/latency); TECH_STACK.md Section 5.

### PR-14: AI Workout Generation — single day

- **Depends on:** PR-07, PR-13
- **Contains:** "Generate Workout" flow for today only: free-text input, recent-history context assembly, one LLM-generated suggestion (blocks/exercises/target sets), review/edit/regenerate/accept UI; accepting creates a `planned` `WorkoutSession` pre-filled per 7.4.
- **Deployable because:** additive entry point alongside the existing ad-hoc "Start Workout."
- **PRD ref:** 7.2 (single-day subset).

### PR-15: Workout review screen

- **Depends on:** PR-14
- **Contains:** the pre-start review screen (block/exercise/target summary) shown when opening a planned day, with "Start Workout" as the primary action.
- **Deployable because:** an additional screen in the existing planned-workout path.
- **PRD ref:** 7.3 (review screen).

### PR-16: Multi-day generation

- **Depends on:** PR-14
- **Contains:** `WorkoutPlan` table + migration; "how many days" prompt (1–7); day-by-day suggestion review list; per-day accept/regenerate/edit.
- **Deployable because:** extends the single-day flow from PR-14 without changing it for the single-day case.
- **PRD ref:** 7.2 (multi-day); Section 9 (`WorkoutPlan`).

### PR-17: Week view & skipped-day handling

- **Depends on:** PR-16
- **Contains:** week view listing planned workouts across a generation range; visual distinction for empty/planned/completed days; skipped-day detection (planned date passed, never started) with a reschedule-or-discard prompt; `discarded` status added to `WorkoutSession`.
- **Deployable because:** additive view + a new prompt on existing session state.
- **PRD ref:** 7.3 (week view, skipped days).

---

## Phase 4 — Feedback loop & richer generation

### PR-18: Difficulty-rating trend in generation

- **Depends on:** PR-09, PR-14
- **Contains:** recent difficulty ratings (7.6 data, already captured since PR-09) included in the generation prompt context; suggestion intensity nudges based on the trend.
- **Deployable because:** prompt-context change only, no schema change.
- **PRD ref:** 7.2 (difficulty-rating context).

### PR-19: Adaptive generation from actual performance

- **Depends on:** PR-08, PR-18
- **Contains:** `Set.suggested_*` fields (reps/weight/duration/distance) + migration, populated when a set is pre-filled from a plan; suggested-vs-actual deltas for recent sessions included in the generation prompt.
- **Deployable because:** additive nullable columns; existing set-logging UI unaffected until generation reads them.
- **PRD ref:** 7.2 (adaptive to actual performance); Section 9 (`Set.suggested_*`).

### PR-20: Workout templates

- **Depends on:** PR-14
- **Contains:** `WorkoutTemplate` table + migration; "Save as Template" from any accepted/completed session; "Start from Template" as an ad-hoc entry point and as a generation shortcut.
- **Deployable because:** new entity + additive entry points; no existing flow changes.
- **PRD ref:** 7.2 (Workout Templates); Section 9 (`WorkoutTemplate`).

### PR-21: "Repeat like last week" & focus-area generation

- **Depends on:** PR-16, PR-20
- **Contains:** generation shortcuts — "same as last week" (`WorkoutPlan.based_on_session_id`) and a focus-area selector (strength/cardio/HIIT/mobility, `focus_tags`) — alongside the existing free-text input.
- **Deployable because:** additive options on the existing generation form.
- **PRD ref:** 7.2 (repeat/focus shortcuts); Section 9 (`focus_tags`, `based_on_session_id`).

---

## Phase 5 — Runs

### PR-22: Run logging via screenshot

- **Depends on:** PR-13
- **Contains:** `Run` table + migration (incl. `distance_unit`); screenshot upload UI; Claude vision extraction; editable confirmation form pre-filled in the account's unit preference; save flow.
- **Deployable because:** a new, self-contained logging path independent of strength-session logic.
- **PRD ref:** 7.7; Section 9 (`Run`).

### PR-23: Runs in history & feedback

- **Depends on:** PR-10, PR-22
- **Contains:** runs appear in Workout History alongside strength sessions; post-workout feedback prompt (7.6) triggered after saving a run.
- **Deployable because:** extends two existing, already-shipped surfaces.
- **PRD ref:** 7.7 (history/feedback integration), 7.8.

---

## Phase 6 — Insights

### PR-24: Progress trends & charts

- **Depends on:** PR-08, PR-19, PR-23
- **Contains:** Recharts integration; per-exercise load/rep charts (scoped by set type); run pace/distance/duration charts; training volume/frequency view; difficulty-rating trend chart; charts surfaced from history and the exercise library.
- **Deployable because:** read-only views over existing data; no write-path changes.
- **PRD ref:** 7.9.

---

## Phase 7 — PWA & resilience

### PR-25: PWA installability

- **Depends on:** PR-01
- **Contains:** web app manifest, service worker (`@ducanh2912/next-pwa`), app icons, cached app shell, install prompt.
- **Deployable because:** additive build config; app behaves identically when not installed.
- **PRD ref:** Section 8 (Installable PWA).

### PR-26: Offline workout logging

- **Depends on:** PR-08, PR-25
- **Contains:** IndexedDB-backed local-first write layer for in-progress workout logging (sets, notes, finish/difficulty rating); sync-on-reconnect; persistent online/offline indicator in the logging view.
- **Deployable because:** logging still works online exactly as before; offline path is additive.
- **PRD ref:** 7.4 (works offline), Section 8 (offline logging).

---

## Phase 8 — Retention

### PR-27: Push notification infrastructure

- **Depends on:** PR-25
- **Contains:** `PushSubscription` table + migration; VAPID key generation/config; frontend permission-request flow tied to the reminders toggle (PR-04); subscription capture per device.
- **Deployable because:** infra + opt-in permission flow; nothing fires yet.
- **PRD ref:** Section 9 (`PushSubscription`); TECH_STACK.md Section 3, Open Questions.

### PR-28: Reminder cron job

- **Depends on:** PR-27
- **Contains:** daily Vercel Cron job checking for users idle 3+ days (no started/completed workout) with `reminders_enabled = true`; sends a Web Push notification via `PushSubscription` records; one reminder per idle streak.
- **Deployable because:** final wiring on top of already-shipped, dormant infrastructure.
- **PRD ref:** 7.10.

---

## Deferred / follow-up items (not their own numbered PR)

- **Password reset via email** (originally part of PR-04): needs a transactional email provider (e.g. Resend) added first — a new external account/dependency deferred pending that decision. Small PR once ready: reset-request page + token generation/expiry + reset-with-token page, gated on `RESEND_API_KEY` (or equivalent) being configured.

---

## Cross-cutting practices (every PR)

- Any PR touching the schema includes its Prisma migration, committed alongside the code that needs it.
- Zod validation at any new API boundary, per TECH_STACK.md Section 3.
- No PR should leave `main` in a state where the app fails to build or the deployed preview 500s on the happy path used before that PR.
- UI-facing PRs get a manual pass against the golden path + at least one edge case before merging (per this repo's engineering norms), even before automated test coverage is built out.
