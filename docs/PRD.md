# Product Requirements Document: Workout Tracker

**Status:** Draft
**Owner:** hasyim.az@gmail.com
**Last updated:** 2026-08-09

## 1. Problem Statement

Today, planning and logging workouts is a two-app, manual process:

1. The user asks ChatGPT to generate a workout plan, sometimes prompting it with context like "I did upper body strength a few days ago" to get a suitable suggestion for today.
2. The user manually re-creates that workout in a separate tracker app, entering each exercise and recording reps/load as they go.
3. Runs are tracked in Strava, disconnected from the strength-training log, so there's no single place that shows "what have I actually done this week."

This app replaces that workflow with a single tool that knows the user's recent training history, generates a suitable workout using an LLM, and logs both strength workouts and runs (via Strava screenshot import) in one place.

## 2. Goals

- Let the user get an AI-generated workout suggestion, in-app, that accounts for recent training history and current feeling/energy level — no more manually copy-pasting context into ChatGPT.
- Let the user generate a plan for a single day or for multiple days at once (up to a full week), so planning ahead is as easy as planning for today.
- Let the user reuse a past workout as a template (e.g. "same as last week") or steer new generation toward a focus area (strength/cardio/HIIT/mobility), instead of always generating from a blank slate.
- Let the user log strength workouts: exercises grouped into blocks/circuits, with sets tracked as reps+weight, duration, or distance depending on the exercise.
- Let the user log runs by uploading a Strava screenshot, with run stats (distance, pace, duration, etc.) auto-extracted via AI vision rather than typed in by hand.
- Give the user a history/view of recent workouts so both they and the AI generator can see what's been trained recently.
- Let the user see trends and charts of their progress over time (e.g. load progression per exercise, run pace/distance over time, training volume/frequency).
- Let the user rate how a completed workout felt (too easy ↔ too hard), and feed that signal — along with what they actually did vs. what was suggested — into future AI-generated suggestions so intensity and load self-adjust over time.
- Let the user install the app to their phone's home screen and open it like a native app (as a Progressive Web App), without needing an app store.
- Run a built-in timer during a workout that alerts the user when a timed exercise or rest period is over, so circuit/interval-style training doesn't require a separate stopwatch.
- Remind the user with a push notification if they haven't logged a workout in a few days, so momentum doesn't quietly die.
- Let the user keep logging a workout even on a spotty gym connection, syncing automatically once back online.
- Support multiple user accounts on a shared, hosted backend (not just a single local user), with each user able to set their own unit preference (metric/imperial).
- Make the two core actions — generating workout(s) and logging one while training — fast and convenient enough to use comfortably standing in a gym, in a handful of taps.

## 3. Non-Goals (v1)

- No native mobile app distributed via app stores — the app is a web app, shipped as an installable Progressive Web App (PWA) rather than a separate iOS/Android codebase (see Section 8).
- No live GPS run tracking — runs are captured after the fact via Strava screenshot, not tracked live in-app.
- No wearable/heart-rate device integration.
- No social features (following other users, sharing workouts, leaderboards).
- No nutrition/diet tracking.
- No direct Strava API integration in v1 (screenshot upload is the mechanism, not OAuth/API sync) — planned for a later version; see Section 11.
- No exercise how-to links or videos in v1 — an exercise is just a name (plus its default muscle group and set type in the library); linking out to instructions/videos is planned for a later version; see Section 11.

## 4. Target Users

Primary user: the requester, an individual who trains with a mix of gym strength sessions and running, and who currently plans workouts with ChatGPT and logs them in a separate app.

Secondary users: friends/family who could sign up and use the same hosted app for their own independent workout tracking (multi-user from v1, but no social/shared features between accounts).

## 5. Key User Stories

1. **As a user**, I want to tell the app how I'm feeling today (e.g. "sore legs, feeling strong upper body") and get an AI-generated workout that takes my recent training history into account, so I don't have to manually explain my recent workouts to ChatGPT every time.
2. **As a user**, I want to review, tweak, and accept an AI-suggested workout before it becomes "today's workout," so I stay in control of what I actually do.
3. **As a user**, I want to log the exercises, sets, reps, and weight I actually performed during a strength workout, so I have an accurate record even if I deviate from the suggested plan.
4. **As a user**, I want to upload a screenshot of my Strava run summary and have the app automatically pull out distance, time, and pace, so I don't have to manually retype run stats.
5. **As a user**, I want to see a history of my recent workouts (strength + runs) in one timeline, so I can tell at a glance what muscle groups or training types I've recently covered.
6. **As a user**, I want to create an account and log in, so my workout history is saved to my account and accessible across devices.
7. **As a user**, I want to log workouts that are structured as blocks/circuits (e.g. "3 rounds of these 3 exercises") rather than one exercise at a time, so my log matches how I actually train.
8. **As a user**, I want to log sets measured by time or distance (e.g. a 30-second plank, a 30m farmer carry), not just reps and weight, so all of my training — not only traditional rep-based lifting — is captured accurately.
9. **As a user**, I want to see charts of my progress over time (e.g. weight/reps trending up on an exercise, run pace or distance over time), so I can tell whether I'm actually improving.
10. **As a user**, I want to rate how a workout felt right after finishing it — too easy, too hard, or about right — so that the next AI-generated suggestion adjusts accordingly instead of repeating something that was already too easy or too hard.
11. **As a user**, I want to generate a whole week of workouts at once instead of one day at a time, so I only have to plan once and then just show up and train.
12. **As a user**, I want to open the app, see today's planned workout, and tap one button to start logging, so there's no setup friction between deciding to train and actually training.
13. **As a user**, I want to glance at the exercises in a planned workout before I start, so I know what I'm about to do and can mentally prepare (or swap the day) without having to already be in the middle of logging.
14. **As a user**, I want to install the app on my phone's home screen, so it opens instantly like a native app instead of me having to navigate to a URL in a browser every gym session.
15. **As a user**, I want the app to time my rounds and rest periods during a circuit workout (e.g. 2 min Row / 2 min Cycle / 2 min Burpees × 3 rounds, 60s rest between rounds) and alert me when it's time to switch or rest, so I can focus on training instead of watching a stopwatch.
16. **As a user**, I want the AI's future suggestions to reflect what I actually lifted or ran, not just what it originally suggested, so the plan keeps pace with my real progress automatically.
17. **As a user**, I want a push notification if I haven't logged a workout in a few days, so I don't quietly fall off track.
18. **As a user**, I want to keep logging my workout even if the gym's wifi drops, with everything syncing once I'm back online, so a bad connection doesn't cost me my log.
19. **As a user**, I want the app to default to kg/km but let me switch to lb/mi in settings, so it matches how I think about weight and distance.
20. **As a user**, I want to tell the app "generate the same workout as last week" or "focus this week on cardio," so I'm not always starting generation from a blank slate.
21. **As a user**, I want the app to ask me whether to reschedule or discard a planned workout I never got around to, instead of it just quietly piling up.

## 6. Core User Flows

The app is built around two primary flows, and both need to be fast and low-friction — one happens during planning downtime, the other happens standing in the gym mid-workout.

### 6.1 Flow 1: Generate Workout(s)
1. User taps "Generate Workout."
2. App asks how many days to generate for: **today only**, or a range (the app asks how many days, e.g. 1–7, to cover "the whole week").
3. User optionally adds free-text context (how they're feeling, goals for the period), or picks a shortcut instead of/alongside free text: repeat a previous workout ("same as last week"), start from a saved template, or steer generation toward a focus area (strength/cardio/HIIT/mobility) — see 7.2.
4. App calls the LLM with recent history, the difficulty-rating trend, and suggested-vs-actual performance from recent sessions (Section 7.2, 7.6) to generate one workout suggestion per requested day, with sensible spacing/variety (e.g. avoiding the same muscle group on consecutive days).
5. User reviews the suggestion(s) — for a multi-day generation, as a simple day-by-day list — and can regenerate, edit, or accept each one individually.
6. Accepted suggestions are saved as **planned** workouts, each tied to a date, ready to be started (Flow 2). Any accepted or completed workout can also be saved as a reusable template for future generation requests.

### 6.2 Flow 2: Select, Start, and Log a Workout
1. User opens the app and sees **Today's Workout** (or picks a different planned day, or starts an ad-hoc workout with no prior plan).
2. Tapping into that workout first shows a **review screen**: a quick, high-level glance at the blocks and exercises planned (names, rounds, target sets) — no logging yet, just a scan-and-confirm before training.
3. From the review screen, user taps "Start Workout" — this marks the session in-progress and opens the focused logging view, pre-filled with the plan's blocks/exercises/target sets.
4. As the user trains, they log each set with minimal input: target reps/weight/duration/distance are pre-filled as a starting point, and the user confirms or adjusts rather than entering everything from scratch. For timed exercises and rest periods, a built-in timer (Section 7.5) counts down and alerts the user automatically. If connectivity drops, logging keeps working — an online/offline indicator shows sync state, and everything queues to sync once back online (Section 7.4).
5. User taps "Finish Workout" when done, which prompts for the post-workout difficulty rating (Section 7.6) and marks the session complete.

The specific convenience bar for these flows is covered in Non-Functional Requirements (Section 8).

## 7. Functional Requirements

### 7.1 Accounts & Auth
- Users can sign up, log in, and log out.
- Each user's workout data is private to their account.
- Password reset / basic account management.
- **Account settings:** a unit system preference — **Metric** (kg, km) or **Imperial** (lb, mi) — defaulting to **Metric**; and a reminder notifications on/off toggle (see 7.10). New sets and runs default to the account's unit system, though a set's unit can still be overridden individually (Section 9).

### 7.2 AI Workout Generation
- User taps "Generate Workout" and chooses a scope: **today only**, or a **range of days** — if a range, the app asks how many days (1–7) to generate for.
- User provides free-text input describing how they're feeling and/or what kind of session(s) they want (e.g. "feeling tired, want something light" or "want to hit legs hard this week"), or picks a structured shortcut instead of/alongside free text:
  - **Repeat a previous workout:** "same as last week" — regenerates using a specific past session (or the equivalent day in a past week) as the baseline, adjusted for the same suggested-vs-actual progression described below.
  - **Start from a saved template:** pick a named template (see **Workout Templates** below) as the starting structure.
  - **Focus area:** strength / cardio / HIIT / mobility — steers what kind of session(s) the LLM proposes without dictating exact exercises.
- The app automatically includes relevant recent workout history (e.g. last 7–14 days: workout type, muscle groups trained, dates) as context to the LLM — the user should not have to manually restate what they did.
- Recent post-workout difficulty ratings (see 7.6) are included as context too, so the LLM can adjust intensity: e.g. consistently "too easy" ratings on an exercise or run pace should nudge the next suggestion's load/pace/volume up, and "too hard" ratings should ease it back.
- **Adaptive to actual performance:** generation also compares each exercise's suggested target (reps/weight/duration/distance) against what the user actually logged, not just the difficulty rating — the `Set` entity keeps both the suggested and actual values (Section 9), so if the user has been logging 22kg against a suggested 20kg on an exercise for several sessions, future suggestions for that exercise trend toward the weight the user has actually been lifting. This runs through the same LLM call (the suggested-vs-actual deltas are included in the prompt context) rather than a separate deterministic progression engine.
- For a multi-day request, the LLM returns one suggestion per day, each assigned to a date, with sensible spacing/variety across the set (e.g. avoiding the same muscle group on consecutive days, alternating strength/run days where the user's history suggests both).
- Each suggestion is a structured workout: one or more blocks, each with its exercises, round count, and suggested sets/reps/weight/duration/distance as appropriate per exercise (and target muscle group), and, for a run suggestion, a suggested type/duration/effort.
- The user can regenerate, edit, or accept each suggestion — individually, even within a multi-day batch.
- Accepting a suggestion saves it as a **planned** workout tied to a date, ready to be started (see 7.4).
- **Workout Templates:** from any accepted or completed session, the user can "Save as Template" — a named, reusable structure (blocks, exercises, target sets, no date) they can later start a new planned or ad-hoc workout from, or reference by name in a future generation request. Templates are static snapshots (saving isn't automatic just because a generated session was tweaked — the user explicitly re-saves if they want the change kept as the template).

### 7.3 Workout Plan & Day Selection
- A "Today" view shows the current day's planned workout front and center (if one exists), with a single primary action to start it.
- A simple week view lists planned workouts across the current generation range, so the user can see and pick any day, not just today — e.g. catching up on a missed session, or getting ahead.
- The user can start an ad-hoc workout with no prior plan (skips straight to 7.4 with an empty session, or from a saved template — 7.2), for days with no generated plan.
- Days with no planned or logged workout are visually distinguished from planned/completed days.
- Selecting a planned day opens a **workout review screen** before logging starts: a compact, high-level summary of the session's blocks and exercises (exercise names, round counts, target sets/reps/weight or duration/distance) so the user can glance at the whole session at once. "Start Workout" is the primary action on this screen; the user can also edit the plan or go back and pick a different day from here instead of committing.
- **Skipped days:** if a planned day's date passes without the session ever being started, the app surfaces it the next time the user opens the app (or starts a new generation request) and asks whether to **reschedule** it to a new date or **discard** it, rather than letting it silently pile up.

### 7.4 Starting & Logging a Workout
- User taps "Start Workout" from the review screen (7.3) on a planned (or ad-hoc) session, which marks it **in progress** and opens a focused logging view.
- Optional free-text notes for warm-up, cardio finisher, and cool-down (e.g. "5 min treadmill warm-up, 8 min incline finisher") — not structured/loggable exercises in v1.
- A session is made up of one or more **blocks**, each block containing one or more exercises and a round count (e.g. "Block 1: 3 rounds of RDL, Incline Press, Farmer Carry"). A block with a single exercise and 1 round is just a normal exercise — the block structure covers both simple and circuit-style workouts without a separate data path. This also covers all-duration circuits, e.g. a block of "2 min Row, 2 min Cycle, 2 min Burpees," round_count 3, rest_seconds 60 — every exercise in the block is a duration-based set (see below), not just one exercise for the whole round.
- Each exercise within a block records its own sets, one set per round (or more, if the user does extra sets within a round). When starting from a plan, sets are pre-filled with the suggested/target values, so the user only needs to confirm or adjust — not re-enter from scratch. The original suggested values are preserved separately from what's actually logged (Section 9), so generation can later compare the two (7.2).
- A set records one of the following, depending on the exercise type:
  - **Reps-based:** reps + load (weight + unit, kg/lb, defaulting to the account's unit preference) — e.g. Leg Press, Bench Press.
  - **Duration-based:** time (seconds) + optional load — e.g. Plank, Battle Ropes.
  - **Distance-based:** distance (meters) + optional load — e.g. Farmer Carry.
- Optional rest period (seconds) per block.
- Optional per-exercise note captured for next time (e.g. "increase to 25kg next session").
- Edit or delete blocks/exercises/sets within a session, including mid-workout.
- Exercises should be selectable from a reusable list (avoid re-typing "Bench Press" every time) — a personal exercise library that grows as the user logs new exercise names, and each library entry remembers its default set type (reps, duration, or distance).
- **Works offline:** if connectivity drops mid-workout, logged sets, notes, and the eventual "Finish Workout" action queue locally and sync automatically once the connection returns — the gym doesn't need reliable wifi for logging to keep working. A small **online/offline indicator** is always visible during an in-progress workout so the user knows whether their data is live-synced or queued for sync.
- User taps "Finish Workout" when done, which marks the session **completed** and triggers Post-Workout Feedback (7.6).

### 7.5 In-Workout Timer
- Every duration-based set (7.4) can drive a countdown timer: when the user starts a timed exercise (e.g. "2 min Row"), the app shows a countdown for its target duration and alerts the user — visually and via sound/vibration — when time is up.
- When a block has a rest period (`rest_seconds`), the app automatically starts a rest countdown as soon as a round finishes, alerting the user when rest is over so they know to begin the next round. This covers full timed circuits like "Round: 2 min Row, 2 min Cycle, 2 min Burpees, × 3 rounds, 60s rest between rounds," where every exercise and the rest between rounds is timed.
- The timer runs automatically as part of the logging flow (7.4) — no separate stopwatch app needed — but the user can pause, skip ahead, or mark a timed set/rest done early.
- **v1 scope:** the timer alerts reliably while the app is open in the foreground with the screen on. Background/locked-screen alerts are **not supported in v1** — the user's own device/watch is the fallback if they lock their phone mid-timer. See Section 11 for the post-v1 possibility of background alerts.

### 7.6 Post-Workout Feedback
- When the user finishes a session — via "Finish Workout" (7.4) or after saving a run (7.7) — the app prompts for a difficulty rating: a 1–5 scale from "Too Easy" to "Too Hard" (3 = "About Right").
- Optional freeform note alongside the rating (e.g. "shoulders were the limiter, not legs").
- Optional session-level energy rating (1–10) and a freeform "goal for next workout" note.
- The rating is optional (skippable) but the app should always ask at the point a session is marked complete, so the signal is captured while it's fresh.
- This feedback feeds into AI Workout Generation as described in 7.2.

### 7.7 Run Logging via Screenshot
- User uploads a screenshot (e.g. from Strava).
- The app uses AI vision to extract run data from the image: distance, duration, pace, and date (whatever is visible/legible).
- Extracted data is shown to the user as an editable form before saving — pre-filled in the account's unit preference (7.1) — so they can correct any misread values.
- The original screenshot is stored alongside the extracted data as a visual record.
- Saved runs appear in the same workout history/timeline as strength sessions, and go through the same post-workout feedback prompt (7.6).
- A run can also fulfill a planned/generated "run" suggestion from 7.2 — the plan sets an expected date/type, and logging happens by uploading the screenshot once the run is done.

### 7.8 Workout History
- Chronological list/timeline of past sessions (strength + runs).
- Each entry shows enough summary detail to be useful as AI-generation context and for the user to browse (date, type, key stats, difficulty rating).
- Ability to view full detail of any past session.

### 7.9 Progress Trends & Charts
- Per-exercise progress chart: load and/or reps over time (e.g. top set weight for Bench Press across sessions), scoped appropriately by set type (reps-based exercises chart weight/reps, duration-based chart time, distance-based chart distance).
- Run progress charts: pace, distance, and duration over time.
- Training volume/frequency view: workouts per week, sessions by type, over a selectable time range (e.g. last 4/12 weeks).
- Difficulty rating trend over time, so the user can see whether workouts are consistently landing too easy/too hard vs. about right.
- Charts are viewable from both the workout history view and from an exercise's entry in the exercise library (to see that exercise's history specifically).

### 7.10 Reminders & Notifications
- If the user hasn't started or completed any workout in **3 days**, the app sends a push notification nudging them back (e.g. "Haven't trained in 3 days — want today's workout?").
- Delivered via Web Push, enabled by the installed PWA (Section 8) — requires the user to grant notification permission; if declined, the app functions normally without reminders rather than blocking anything.
- At most one reminder is sent per idle streak (no repeated daily nagging) — the streak resets once the user starts or completes a workout.
- Reminders can be turned on/off in account settings (7.1); off by default until the user explicitly grants notification permission (an opt-in, not an assumed default).

## 8. Non-Functional Requirements

- **Data persistence:** hosted database; user data must survive across sessions/devices, not just be stored in the browser.
- **Security:** user data is private per-account; passwords hashed; standard auth best practices (session/token expiry, no plaintext secrets).
- **AI cost/latency awareness:** LLM calls (workout generation, image parsing) should have reasonable response times and the app should handle API failures gracefully (e.g. show an error and let the user retry or enter data manually rather than blocking them).
- **Responsive design:** usable on both desktop and mobile browsers, since workout logging often happens mid-gym on a phone.
- **Low-friction core loop:** logging a single set — the most frequent in-workout action — should take no more than a couple of taps/inputs, aided by pre-filled target values from the plan. Starting a workout from the "Today" view should be a single tap. The app should be comfortably usable one-handed on a phone mid-workout.
- **Installable (PWA):** the app ships a web app manifest and service worker so mobile/desktop browsers can install it to the home screen/app list and it launches full-screen like a native app (no browser chrome). Core static assets (app shell, icons) are cached so the app opens quickly even on a flaky gym Wi-Fi connection.
- **Offline logging:** an in-progress workout (7.4) keeps working without connectivity — logged sets, notes, and the finish/difficulty-rating step queue locally and sync automatically once back online. A persistent online/offline indicator reflects current connectivity so the user always knows their sync state. Workout *generation* and run-screenshot extraction still require a live connection (they're LLM calls), per the AI cost/latency requirement above.

## 9. Data Model (Initial Sketch)

- **User**: id, email, password hash, unit_system (metric / imperial, default metric), reminders_enabled (bool, default true), created_at
- **PushSubscription**: id, user_id, endpoint, p256dh_key, auth_key, created_at — one per installed device/browser, used to deliver reminder push notifications (7.10)
- **Exercise** (per-user library): id, user_id, name, default muscle group (optional), default set type (reps / duration / distance)
- **WorkoutTemplate**: id, user_id, name, focus_tags (optional array: strength / cardio / hiit / mobility), structure (snapshot of blocks/exercises/target sets), created_from_session_id (optional), created_at
- **WorkoutPlan**: id, user_id, start_date, num_days, source_prompt (optional), focus_tags (optional array), based_on_session_id (optional, set when generation mode is "repeat like last week"), created_at — groups a batch of sessions generated together in one Flow 1 request; a single-day generation is just a plan with num_days = 1
- **WorkoutSession**: id, user_id, plan_id (nullable), template_id (nullable, if started from a template), date, status (planned / in_progress / completed / discarded), type (strength / run), label, focus_tags (optional array), warmup_notes, finisher_notes, cooldown_notes, energy_rating (1–10, optional), difficulty_rating (1–5, "Too Easy"–"Too Hard", optional), difficulty_note (optional), goal_for_next (optional), source (manual / ai_generated), created_at, started_at (optional), completed_at (optional)
- **WorkoutBlock**: id, session_id, order, round_count, rest_seconds (optional) — a block groups one or more exercises done together for N rounds; a single-exercise, 1-round block is just a normal exercise
- **WorkoutExercise**: id, block_id, exercise_id, order, note_for_next_time (optional)
- **Set**: id, workout_exercise_id, round_number, set_type (reps / duration / distance), reps (nullable), weight (nullable), weight_unit (nullable), duration_seconds (nullable), distance_meters (nullable), suggested_reps (nullable), suggested_weight (nullable), suggested_duration_seconds (nullable), suggested_distance_meters (nullable) — the `suggested_*` fields preserve the AI's original target values separately from what the user actually logged, so generation can compare suggested vs. actual over time (7.2)
- **Run**: id, session_id, distance, distance_unit (km / mi), duration, pace, screenshot_url, raw_extracted_data (json)

This is a starting point for engineering design, not final schema.

## 10. Suggested Tech Direction

Given a hosted, multi-user web app with LLM text + vision calls:

- **Frontend:** a modern web framework (e.g. React/Next.js) for a responsive SPA, built/configured as an installable PWA (web app manifest, service worker, app icons — e.g. via `next-pwa` or an equivalent for the chosen framework).
- **Backend:** a lightweight API server (e.g. Next.js API routes, or a separate Node/Python service) handling auth, CRUD, and orchestrating LLM calls.
- **Database:** hosted relational DB (e.g. Postgres, via a managed provider) for user, workout, and exercise data.
- **AI:** an LLM with both text and vision capability for (a) workout generation from history + free-text feeling, and (b) extracting run stats from uploaded screenshots.
- **File storage:** object storage (e.g. S3-compatible) for uploaded screenshots.
- **Charting:** a frontend charting library (e.g. Recharts, Chart.js) for progress trends (Section 7.9).

Final stack choice is an engineering decision to be made at implementation time; see [TECH_STACK.md](./TECH_STACK.md) for the concrete choices.

## 11. Future Considerations (Post-v1)

- **Direct Strava API integration (OAuth):** replace screenshot upload with a direct sync, reducing manual steps. Confirmed direction for a later version, not v1 (Section 3).
- **Exercise how-to links/videos:** attach an instructional link and/or YouTube video to exercises. Confirmed direction for a later version, not v1 (Section 3).
- **Background/locked-screen timer alerts (7.5):** once Web Push infrastructure exists for reminders (7.10), explore reusing it to fire timer alerts when the app is backgrounded or the screen is locked, rather than requiring the app to stay open in the foreground.
- **Offline sync conflict handling (8):** v1 assumes conflicts are rare (a session is normally edited from one device at a time) and takes a last-write-wins approach; revisit if editing the same session from two devices while both are offline turns out to be common.
- **Reminder tuning:** the 3-day idle threshold (7.10) is fixed in v1; consider making it user-configurable later.

## 12. Success Metrics

- User replaces their ChatGPT-copy-paste workflow entirely with in-app generation (qualitative: "I stopped going to ChatGPT separately").
- Time to log a completed workout session is faster than the current manual process.
- Run screenshot extraction is accurate enough that manual correction is rare (target: minimal edits needed on extracted fields).
- Time from opening the app to starting a workout (tap "Start" to first set logged) is minimal — a proxy for how frictionless the core loop is.
- Reminder notifications measurably bring the user back (a workout logged within 24h of a reminder) rather than being ignored — a proxy for whether the nudge is actually working.
