# Product Requirements Document: Workout Tracker

**Status:** Draft
**Owner:** hasyim.az@gmail.com
**Last updated:** 2026-08-08

## 1. Problem Statement

Today, planning and logging workouts is a two-app, manual process:

1. The user asks ChatGPT to generate a workout plan, sometimes prompting it with context like "I did upper body strength a few days ago" to get a suitable suggestion for today.
2. The user manually re-creates that workout in a separate tracker app, entering each exercise and recording reps/load as they go.
3. Runs are tracked in Strava, disconnected from the strength-training log, so there's no single place that shows "what have I actually done this week."

This app replaces that workflow with a single tool that knows the user's recent training history, generates a suitable workout using an LLM, and logs both strength workouts and runs (via Strava screenshot import) in one place.

## 2. Goals

- Let the user get an AI-generated workout suggestion, in-app, that accounts for recent training history and current feeling/energy level — no more manually copy-pasting context into ChatGPT.
- Let the user generate a plan for a single day or for multiple days at once (up to a full week), so planning ahead is as easy as planning for today.
- Let the user log strength workouts: exercises grouped into blocks/circuits, with sets tracked as reps+weight, duration, or distance depending on the exercise.
- Let the user log runs by uploading a Strava screenshot, with run stats (distance, pace, duration, etc.) auto-extracted via AI vision rather than typed in by hand.
- Give the user a history/view of recent workouts so both they and the AI generator can see what's been trained recently.
- Let the user see trends and charts of their progress over time (e.g. load progression per exercise, run pace/distance over time, training volume/frequency).
- Let the user rate how a completed workout felt (too easy ↔ too hard), and feed that signal into future AI-generated suggestions so intensity self-adjusts over time.
- Support multiple user accounts on a shared, hosted backend (not just a single local user).
- Make the two core actions — generating workout(s) and logging one while training — fast and convenient enough to use comfortably standing in a gym, in a handful of taps.

## 3. Non-Goals (v1)

- No native mobile app — web app only (responsive web is in scope; iOS/Android apps are not).
- No live GPS run tracking — runs are captured after the fact via Strava screenshot, not tracked live in-app.
- No wearable/heart-rate device integration.
- No social features (following other users, sharing workouts, leaderboards).
- No nutrition/diet tracking.
- No direct Strava API integration in v1 (screenshot upload is the mechanism, not OAuth/API sync) — see Section 11 for future consideration.

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

## 6. Core User Flows

The app is built around two primary flows, and both need to be fast and low-friction — one happens during planning downtime, the other happens standing in the gym mid-workout.

### 6.1 Flow 1: Generate Workout(s)
1. User taps "Generate Workout."
2. App asks how many days to generate for: **today only**, or a range (the app asks how many days, e.g. 1–7, to cover "the whole week").
3. User optionally adds free-text context (how they're feeling, goals for the period).
4. App calls the LLM with recent history and the difficulty-rating trend (Section 7.5) to generate one workout suggestion per requested day, with sensible spacing/variety (e.g. avoiding the same muscle group on consecutive days).
5. User reviews the suggestion(s) — for a multi-day generation, as a simple day-by-day list — and can regenerate, edit, or accept each one individually.
6. Accepted suggestions are saved as **planned** workouts, each tied to a date, ready to be started (Flow 2).

### 6.2 Flow 2: Select, Start, and Log a Workout
1. User opens the app and sees **Today's Workout** (or picks a different planned day, or starts an ad-hoc workout with no prior plan).
2. User taps "Start Workout" — this marks the session in-progress and opens a focused logging view, pre-filled with the plan's blocks/exercises/target sets.
3. As the user trains, they log each set with minimal input: target reps/weight/duration/distance are pre-filled as a starting point, and the user confirms or adjusts rather than entering everything from scratch.
4. User taps "Finish Workout" when done, which prompts for the post-workout difficulty rating (Section 7.5) and marks the session complete.

The specific convenience bar for these flows is covered in Non-Functional Requirements (Section 8).

## 7. Functional Requirements

### 7.1 Accounts & Auth
- Users can sign up, log in, and log out.
- Each user's workout data is private to their account.
- Password reset / basic account management.

### 7.2 AI Workout Generation
- User taps "Generate Workout" and chooses a scope: **today only**, or a **range of days** — if a range, the app asks how many days (1–7) to generate for.
- User provides free-text input describing how they're feeling and/or what kind of session(s) they want (e.g. "feeling tired, want something light" or "want to hit legs hard this week").
- The app automatically includes relevant recent workout history (e.g. last 7–14 days: workout type, muscle groups trained, dates) as context to the LLM — the user should not have to manually restate what they did.
- Recent post-workout difficulty ratings (see 7.5) are included as context too, so the LLM can adjust intensity: e.g. consistently "too easy" ratings on an exercise or run pace should nudge the next suggestion's load/pace/volume up, and "too hard" ratings should ease it back.
- For a multi-day request, the LLM returns one suggestion per day, each assigned to a date, with sensible spacing/variety across the set (e.g. avoiding the same muscle group on consecutive days, alternating strength/run days where the user's history suggests both).
- Each suggestion is a structured workout: one or more blocks, each with its exercises, round count, and suggested sets/reps/weight/duration/distance as appropriate per exercise (and target muscle group), and, for a run suggestion, a suggested type/duration/effort.
- The user can regenerate, edit, or accept each suggestion — individually, even within a multi-day batch.
- Accepting a suggestion saves it as a **planned** workout tied to a date, ready to be started (see 7.4).

### 7.3 Workout Plan & Day Selection
- A "Today" view shows the current day's planned workout front and center (if one exists), with a single primary action to start it.
- A simple week view lists planned workouts across the current generation range, so the user can see and pick any day, not just today — e.g. catching up on a missed session, or getting ahead.
- The user can start an ad-hoc workout with no prior plan (skips straight to 7.4 with an empty session), for days with no generated plan.
- Days with no planned or logged workout are visually distinguished from planned/completed days.

### 7.4 Starting & Logging a Workout
- User taps "Start Workout" on a planned (or ad-hoc) session, which marks it **in progress** and opens a focused logging view.
- Optional free-text notes for warm-up, cardio finisher, and cool-down (e.g. "5 min treadmill warm-up, 8 min incline finisher") — not structured/loggable exercises in v1.
- A session is made up of one or more **blocks**, each block containing one or more exercises and a round count (e.g. "Block 1: 3 rounds of RDL, Incline Press, Farmer Carry"). A block with a single exercise and 1 round is just a normal exercise — the block structure covers both simple and circuit-style workouts without a separate data path.
- Each exercise within a block records its own sets, one set per round (or more, if the user does extra sets within a round). When starting from a plan, sets are pre-filled with the suggested/target values, so the user only needs to confirm or adjust — not re-enter from scratch.
- A set records one of the following, depending on the exercise type:
  - **Reps-based:** reps + load (weight + unit, kg/lb) — e.g. Leg Press, Bench Press.
  - **Duration-based:** time (seconds) + optional load — e.g. Plank, Battle Ropes.
  - **Distance-based:** distance (meters) + optional load — e.g. Farmer Carry.
- Optional rest period (seconds) per block.
- Optional per-exercise note captured for next time (e.g. "increase to 25kg next session").
- Edit or delete blocks/exercises/sets within a session, including mid-workout.
- Exercises should be selectable from a reusable list (avoid re-typing "Bench Press" every time) — a personal exercise library that grows as the user logs new exercise names, and each library entry remembers its default set type (reps, duration, or distance).
- User taps "Finish Workout" when done, which marks the session **completed** and triggers Post-Workout Feedback (7.5).

### 7.5 Post-Workout Feedback
- When the user finishes a session — via "Finish Workout" (7.4) or after saving a run (7.6) — the app prompts for a difficulty rating: a 1–5 scale from "Too Easy" to "Too Hard" (3 = "About Right").
- Optional freeform note alongside the rating (e.g. "shoulders were the limiter, not legs").
- Optional session-level energy rating (1–10) and a freeform "goal for next workout" note.
- The rating is optional (skippable) but the app should always ask at the point a session is marked complete, so the signal is captured while it's fresh.
- This feedback feeds into AI Workout Generation as described in 7.2.

### 7.6 Run Logging via Screenshot
- User uploads a screenshot (e.g. from Strava).
- The app uses AI vision to extract run data from the image: distance, duration, pace, and date (whatever is visible/legible).
- Extracted data is shown to the user as an editable form before saving, so they can correct any misread values.
- The original screenshot is stored alongside the extracted data as a visual record.
- Saved runs appear in the same workout history/timeline as strength sessions, and go through the same post-workout feedback prompt (7.5).
- A run can also fulfill a planned/generated "run" suggestion from 7.2 — the plan sets an expected date/type, and logging happens by uploading the screenshot once the run is done.

### 7.7 Workout History
- Chronological list/timeline of past sessions (strength + runs).
- Each entry shows enough summary detail to be useful as AI-generation context and for the user to browse (date, type, key stats, difficulty rating).
- Ability to view full detail of any past session.

### 7.8 Progress Trends & Charts
- Per-exercise progress chart: load and/or reps over time (e.g. top set weight for Bench Press across sessions), scoped appropriately by set type (reps-based exercises chart weight/reps, duration-based chart time, distance-based chart distance).
- Run progress charts: pace, distance, and duration over time.
- Training volume/frequency view: workouts per week, sessions by type, over a selectable time range (e.g. last 4/12 weeks).
- Difficulty rating trend over time, so the user can see whether workouts are consistently landing too easy/too hard vs. about right.
- Charts are viewable from both the workout history view and from an exercise's entry in the exercise library (to see that exercise's history specifically).

## 8. Non-Functional Requirements

- **Data persistence:** hosted database; user data must survive across sessions/devices, not just be stored in the browser.
- **Security:** user data is private per-account; passwords hashed; standard auth best practices (session/token expiry, no plaintext secrets).
- **AI cost/latency awareness:** LLM calls (workout generation, image parsing) should have reasonable response times and the app should handle API failures gracefully (e.g. show an error and let the user retry or enter data manually rather than blocking them).
- **Responsive design:** usable on both desktop and mobile browsers, since workout logging often happens mid-gym on a phone.
- **Low-friction core loop:** logging a single set — the most frequent in-workout action — should take no more than a couple of taps/inputs, aided by pre-filled target values from the plan. Starting a workout from the "Today" view should be a single tap. The app should be comfortably usable one-handed on a phone mid-workout.

## 9. Data Model (Initial Sketch)

- **User**: id, email, password hash, created_at
- **Exercise** (per-user library): id, user_id, name, default muscle group (optional), default set type (reps / duration / distance)
- **WorkoutPlan**: id, user_id, start_date, num_days, source_prompt (optional), created_at — groups a batch of sessions generated together in one Flow 1 request; a single-day generation is just a plan with num_days = 1
- **WorkoutSession**: id, user_id, plan_id (nullable), date, status (planned / in_progress / completed), type (strength / run), label, warmup_notes, finisher_notes, cooldown_notes, energy_rating (1–10, optional), difficulty_rating (1–5, "Too Easy"–"Too Hard", optional), difficulty_note (optional), goal_for_next (optional), source (manual / ai_generated), created_at, started_at (optional), completed_at (optional)
- **WorkoutBlock**: id, session_id, order, round_count, rest_seconds (optional) — a block groups one or more exercises done together for N rounds; a single-exercise, 1-round block is just a normal exercise
- **WorkoutExercise**: id, block_id, exercise_id, order, note_for_next_time (optional)
- **Set**: id, workout_exercise_id, round_number, set_type (reps / duration / distance), reps (nullable), weight (nullable), weight_unit (nullable), duration_seconds (nullable), distance_meters (nullable)
- **Run**: id, session_id, distance, duration, pace, screenshot_url, raw_extracted_data (json)

This is a starting point for engineering design, not final schema.

## 10. Suggested Tech Direction

Given a hosted, multi-user web app with LLM text + vision calls:

- **Frontend:** a modern web framework (e.g. React/Next.js) for a responsive SPA.
- **Backend:** a lightweight API server (e.g. Next.js API routes, or a separate Node/Python service) handling auth, CRUD, and orchestrating LLM calls.
- **Database:** hosted relational DB (e.g. Postgres, via a managed provider) for user, workout, and exercise data.
- **AI:** an LLM with both text and vision capability for (a) workout generation from history + free-text feeling, and (b) extracting run stats from uploaded screenshots.
- **File storage:** object storage (e.g. S3-compatible) for uploaded screenshots.
- **Charting:** a frontend charting library (e.g. Recharts, Chart.js) for progress trends (Section 7.8).

Final stack choice is an engineering decision to be made at implementation time; this section is a directional recommendation, not a hard requirement.

## 11. Open Questions / Future Considerations

- Should the app eventually integrate directly with the Strava API (OAuth) instead of screenshot upload, to reduce manual steps? (Explicitly out of scope for v1 per Section 3.)
- Should AI-generated workouts learn from what the user actually completed vs. what was suggested, over time (adaptive suggestions)? Partially addressed by the difficulty-rating feedback loop (7.2, 7.5) — open question is how aggressively/automatically the LLM should act on it vs. just surfacing the trend for the user to consider.
- Should there be reminders/notifications (e.g. "you haven't logged a workout in 3 days")?
- Units: kg vs lb, and metric vs imperial for runs — confirm default and whether it's user-configurable.
- Should workout templates/plans (multi-day programs) be supported as reusable templates, or is each week generated independently every time?
- Should there be an in-app rest timer during a workout (counting down a block's rest_seconds), or is that left to the user's own device/watch?
- If a planned day is skipped entirely (never started), should it just sit there indefinitely, or should the next generation request offer to reschedule/discard unstarted planned days?

## 12. Success Metrics

- User replaces their ChatGPT-copy-paste workflow entirely with in-app generation (qualitative: "I stopped going to ChatGPT separately").
- Time to log a completed workout session is faster than the current manual process.
- Run screenshot extraction is accurate enough that manual correction is rare (target: minimal edits needed on extracted fields).
- Time from opening the app to starting a workout (tap "Start" to first set logged) is minimal — a proxy for how frictionless the core loop is.
