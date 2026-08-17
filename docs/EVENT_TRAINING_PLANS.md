# Feature Plan: Event-Based Training Plans

**Status:** Proposed — not yet implemented, pending sign-off on the open questions in Section 6.
**Related:** [PRD.md](./PRD.md), [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), [TECH_STACK.md](./TECH_STACK.md)

## 1. Problem Statement

Today, AI Workout Generation (PRD 7.2) plans one day or one week at a time, reacting to recent history and difficulty ratings. It has no concept of a future goal — a user training for a Hyrox event 10 weeks out gets the same kind of session-by-session suggestions as someone with no particular target, with no periodization (building a base, then intensity, then tapering before the event) and no visibility into "am I actually on track."

This feature lets a user declare an upcoming event, gets a periodized roadmap from today to that event, and makes every subsequent generated workout aware of where they are in that roadmap — automatically, without having to ask for it each time.

## 2. Goals

- User can tell the app about a future event: what kind of event, and the date.
- The app proposes a periodized training roadmap spanning from today to the event date, broken into phases (e.g. base building → intensity → taper).
- The roadmap is visible in its own UI, not just backend context — the user can see the phases, their date ranges, and where "today" falls.
- Once an event exists, **every** relevant workout suggestion (single-day, multi-day, and the default "what should I do today" case) automatically factors in the current phase — the user doesn't have to opt in per generation.
- Reuses the existing generation architecture (one more piece of context threaded into the same Claude calls) rather than introducing a second, parallel generation system.

## 3. Non-Goals (v1)

- No live coaching mid-event (e.g. race-day pacing guidance) — the roadmap governs training *up to* the event, not the event itself.
- No automatic roadmap rewriting in response to missed sessions or difficulty ratings — v1 generates the roadmap once and lets the user manually regenerate it if they fall meaningfully off track (see Section 6, open question 5).
- No multi-event support in v1 — one active upcoming event at a time (see Section 6, open question 2).
- No calendar/ICS export of the roadmap.

## 4. Event Types (proposed fixed set)

A small, fixed enum rather than free text, so the roadmap-generation prompt can lean on real periodization knowledge for that category instead of guessing generically. Proposed set, informed by the event types this app's existing session types (`STRENGTH`, `RUN`) already cover well:

| Type | Example | Periodization shape |
| --- | --- | --- |
| `HYROX` | Hyrox, DEKA, similar hybrid races | Mixed strength-endurance base → race-pace station work → taper |
| `RUNNING_RACE` | 5K, 10K, half marathon, marathon | Aerobic base → tempo/speed work → taper. Distance matters a lot here (marathon taper looks very different from a 5K taper) — worth an optional `distance` sub-field (`FIVE_K` / `TEN_K` / `HALF_MARATHON` / `MARATHON`) so the roadmap prompt can be specific. |
| `STRENGTH_COMPETITION` | Powerlifting or weightlifting meet | Volume accumulation → intensity/peaking → deload/taper toward 1RM attempts |
| `GENERAL_FITNESS` | "Be in good shape by my wedding/vacation on X" — no formal race format | Looser: progressive overload with a general conditioning trend, no hard taper requirement |

This is a starting proposal, not a final answer — see open question 1.

## 5. Data Model

Two new tables, additive only — nothing existing changes shape.

**Event**
- `id`, `userId`
- `name` (free text label, e.g. "Hyrox London" — the type conveys the category, this is just what the user calls it)
- `type` (enum, Section 4)
- `runDistance` (nullable enum, only meaningful when `type = RUNNING_RACE`)
- `eventDate` (date, must be in the future at creation)
- `status` (`UPCOMING` / `COMPLETED` / `CANCELLED`) — only an `UPCOMING` event is "active" for generation purposes; marking one `COMPLETED`/`CANCELLED` stops it from influencing new suggestions but keeps it in the user's history
- `createdAt`

**TrainingPhase** (child of `Event`)
- `id`, `eventId`, `order`
- `name` (free text, e.g. "Base", "Build", "Peak Week", "Taper" — generated per-event by Claude rather than a fixed list, since phase count and naming should flex with how much time is actually available and the event type)
- `startDate`, `endDate`
- `focusSummary` (a sentence or two on what this phase emphasizes — shown in the UI and fed back into generation as context)
- `sessionsPerWeekTarget` (nullable int — a rough structured hint for both the phase-timeline UI and generation, alongside the free-text `focusSummary`)

Phases are generated once, together, when the event is created (see Section 7) and persisted as rows — not regenerated on every page load.

## 6. Open Questions

These need an explicit answer before implementation starts; my recommendation is stated first in each.

1. **Exact event type list (Section 4).** Recommend the four above. Confirm, trim, or extend.
2. **One active event at a time, or several concurrent goals?** Recommend one — simpler mental model ("what am I training for" has one answer), simpler generation context (no need to disambiguate which goal a given day's session serves), and matches how most people actually train for one primary target at a time. A user could still log a `COMPLETED`/`CANCELLED` event and start a new one immediately after.
3. **Does phase count/length vary by event type and time available, or are phases templated per type?** Recommend letting Claude decide at roadmap-generation time (a Hyrox 6 weeks out might get 2 phases; the same event 16 weeks out might get 4) rather than hardcoding phase templates per type — matches how generation already works everywhere else in this app (LLM reasons over context rather than the app encoding a fixed decision tree).
4. **What happens when the event date arrives/passes?** Recommend a lightweight prompt similar to post-workout feedback (PRD 7.6) — "How did it go?" with a freeform note — once the event date passes and the user next opens the app, then auto-transition the event to `COMPLETED`. Could ship as a fast-follow rather than blocking the rest of the feature.
5. **Should the roadmap ever regenerate automatically** (e.g. a string of "too hard" ratings mid-Build phase)? Recommend no for v1 — keep the roadmap stable once created so it doesn't silently rewrite itself under the user, but add a manual "Regenerate roadmap" action on the event page. Auto-adjustment is a reasonable fast-follow once the manual version is proven out.
6. **Editing an event's date after creation.** Recommend allowing it, and treating it the same as creating a new roadmap from scratch (simplest to reason about) rather than trying to stretch/compress existing phases.

## 7. How Roadmap Generation Works

1. User fills out a short form: name, type (+ distance if `RUNNING_RACE`), date.
2. On submit, the app calls Claude (via the existing `requestStructuredOutput` wrapper in `src/lib/claude.ts` — no new AI plumbing needed) with a new structured-output schema: an array of phases, each with a name, start/end date, focus summary, and session-frequency target. The prompt includes the event type/date, days remaining, and the same recent-history/library context `buildGenerationContext` already assembles for regular generation.
3. The returned phases are persisted as `TrainingPhase` rows.
4. The user lands on the event detail page showing the roadmap.

## 8. UI Surfaces

- **`/events/new`** — create-event form (name, type, optional run distance, date). Entry point alongside "Log a run" in the bottom nav's "More" menu.
- **`/events/[id]`** — event detail / roadmap view: event name, type, date, a "N weeks to go" countdown, and a phase timeline (each phase as a card/row: date range, focus summary, target frequency, with a visual marker for where "today" falls). Actions: mark completed/cancelled, edit date, regenerate roadmap.
- **Dashboard integration** — when there's an active (`UPCOMING`) event, a small persistent card near the top of the dashboard (similar weight to the existing "This week" progress card): event name, countdown, current phase name, linking to `/events/[id]`.

## 9. Making Generation Event-Aware

This is the part that makes the feature more than a static roadmap viewer. The existing generation architecture (`src/app/generate/actions.ts`) already assembles a bag of context — recent history, difficulty trend, performance deltas, standing preferences — into every Claude call via `buildGenerationContext`. Event awareness is one more piece of context in that same bag, not a new mechanism:

- `buildGenerationContext` gains an `eventContextLine`: when the user has an `UPCOMING` event, find the `TrainingPhase` covering the target generation date and produce a line like *"The user is training for a Hyrox on [date] (6 weeks away), currently in the 'Build' phase: [focusSummary]. Aim for roughly [sessionsPerWeekTarget] sessions/week."*
- This line is threaded into `preferenceSystemLines`/`preferencePromptLines` (the same shared helpers duration/equipment/avoid-list context already goes through) so it reaches **all** three generation entry points — single-day, multi-day, and revision — automatically, with no per-call opt-in.
- No change needed to the "no equipment"/location-override logic shipped in the equipment-preferences work — event context and equipment context are independent axes that both just add lines to the same prompt.

## 10. Proposed Implementation Plan

Following this repo's existing PR-sizing convention (see IMPLEMENTATION_PLAN.md) — each slice merges to `main` in a working state on its own.

### PR A: Event schema + creation flow
- **Contains:** `Event` + `TrainingPhase` tables/migration; `/events/new` form (name, type, optional run distance, date — date must be future, and only one `UPCOMING` event per user enforced server-side); minimal `/events/[id]` page showing just the event's own fields (no roadmap yet).
- **Deployable because:** self-contained new surface; nothing else references it yet.

### PR B: Roadmap generation + timeline UI
- **Depends on:** PR A
- **Contains:** the Claude call + schema described in Section 7, wired to run on event creation; phase timeline UI on `/events/[id]`.
- **Deployable because:** extends PR A's page; still isolated from the existing generation flow.

### PR C: Dashboard integration
- **Depends on:** PR B
- **Contains:** the active-event card on the dashboard.
- **Deployable because:** additive UI reading data that already exists by this point.

### PR D: Event-aware generation
- **Depends on:** PR B
- **Contains:** the `eventContextLine` addition to `buildGenerationContext`/`preferenceSystemLines`/`preferencePromptLines`, reaching single-day, multi-day, and revision generation.
- **Deployable because:** prompt-context-only change, no schema change, degrades to current behavior with no active event.

### PR E (fast-follow, not blocking): lifecycle polish
- **Depends on:** PR D
- **Contains:** manual "Regenerate roadmap" action; mark event completed/cancelled; post-event "how did it go" prompt (open question 4).

## 11. Success Criteria

- A user can create an event and see a sensible, genuinely periodized roadmap (not just N evenly-spaced identical phases) within seconds of submitting.
- Generated workouts visibly reflect the current phase in their rationale/shape (e.g. taper-week suggestions are lighter than build-week ones for the same user) without the user mentioning the event in their free-text request.
- No regression to generation when a user has no active event — every new context line degrades to "no event" gracefully, matching how every other optional context line in `buildGenerationContext` already works.
