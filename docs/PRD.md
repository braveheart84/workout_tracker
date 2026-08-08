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
- Let the user log strength workouts: exercises grouped into blocks/circuits, with sets tracked as reps+weight, duration, or distance depending on the exercise.
- Let the user log runs by uploading a Strava screenshot, with run stats (distance, pace, duration, etc.) auto-extracted via AI vision rather than typed in by hand.
- Give the user a history/view of recent workouts so both they and the AI generator can see what's been trained recently.
- Let the user see trends and charts of their progress over time (e.g. load progression per exercise, run pace/distance over time, training volume/frequency).
- Let the user rate how a completed workout felt (too easy ↔ too hard), and feed that signal into future AI-generated suggestions so intensity self-adjusts over time.
- Support multiple user accounts on a shared, hosted backend (not just a single local user).

## 3. Non-Goals (v1)

- No native mobile app — web app only (responsive web is in scope; iOS/Android apps are not).
- No live GPS run tracking — runs are captured after the fact via Strava screenshot, not tracked live in-app.
- No wearable/heart-rate device integration.
- No social features (following other users, sharing workouts, leaderboards).
- No nutrition/diet tracking.
- No direct Strava API integration in v1 (screenshot upload is the mechanism, not OAuth/API sync) — see Section 10 for future consideration.

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

## 6. Functional Requirements

### 6.1 Accounts & Auth
- Users can sign up, log in, and log out.
- Each user's workout data is private to their account.
- Password reset / basic account management.

### 6.2 AI Workout Generation
- User provides free-text input describing how they're feeling and/or what kind of session they want (e.g. "feeling tired, want something light" or "want to hit legs hard").
- The app automatically includes relevant recent workout history (e.g. last 7–14 days: workout type, muscle groups trained, dates) as context to the LLM — the user should not have to manually restate what they did.
- Recent post-workout difficulty ratings (see 6.4) are included as context too, so the LLM can adjust intensity: e.g. consistently "too easy" ratings on an exercise or run pace should nudge the next suggestion's load/pace/volume up, and "too hard" ratings should ease it back.
- The LLM returns a structured workout suggestion: one or more blocks, each with its exercises, round count, and suggested sets/reps/weight/duration/distance as appropriate per exercise (and target muscle group), and, for a run suggestion, a suggested type/duration/effort.
- The user can regenerate, edit, or accept the suggestion.
- Accepting a suggestion pre-fills a new workout log entry, which the user then completes as they train (see 6.3).

### 6.3 Strength Workout Logging
- Create a workout session (date, optional notes, optional label e.g. "Full Body Strength A").
- Optional free-text notes for warm-up, cardio finisher, and cool-down (e.g. "5 min treadmill warm-up, 8 min incline finisher") — not structured/loggable exercises in v1.
- A session is made up of one or more **blocks**, each block containing one or more exercises and a round count (e.g. "Block 1: 3 rounds of RDL, Incline Press, Farmer Carry"). A block with a single exercise and 1 round is just a normal exercise — the block structure covers both simple and circuit-style workouts without a separate data path.
- Each exercise within a block records its own sets, one set per round (or more, if the user does extra sets within a round).
- A set records one of the following, depending on the exercise type:
  - **Reps-based:** reps + load (weight + unit, kg/lb) — e.g. Leg Press, Bench Press.
  - **Duration-based:** time (seconds) + optional load — e.g. Plank, Battle Ropes.
  - **Distance-based:** distance (meters) + optional load — e.g. Farmer Carry.
- Optional rest period (seconds) per block.
- Optional per-exercise note captured for next time (e.g. "increase to 25kg next session").
- Edit or delete blocks/exercises/sets within a session after creation.
- Exercises should be selectable from a reusable list (avoid re-typing "Bench Press" every time) — a personal exercise library that grows as the user logs new exercise names, and each library entry remembers its default set type (reps, duration, or distance).

### 6.4 Post-Workout Feedback
- When the user finishes logging a session (strength or run), the app prompts for a difficulty rating: a 1–5 scale from "Too Easy" to "Too Hard" (3 = "About Right").
- Optional freeform note alongside the rating (e.g. "shoulders were the limiter, not legs").
- Optional session-level energy rating (1–10) and a freeform "goal for next workout" note.
- The rating is optional (skippable) but the app should always ask at the point a session is marked complete, so the signal is captured while it's fresh.
- This feedback feeds into AI Workout Generation as described in 6.2.

### 6.5 Run Logging via Screenshot
- User uploads a screenshot (e.g. from Strava).
- The app uses AI vision to extract run data from the image: distance, duration, pace, and date (whatever is visible/legible).
- Extracted data is shown to the user as an editable form before saving, so they can correct any misread values.
- The original screenshot is stored alongside the extracted data as a visual record.
- Saved runs appear in the same workout history/timeline as strength sessions, and go through the same post-workout feedback prompt (6.4).

### 6.6 Workout History
- Chronological list/timeline of past sessions (strength + runs).
- Each entry shows enough summary detail to be useful as AI-generation context and for the user to browse (date, type, key stats, difficulty rating).
- Ability to view full detail of any past session.

### 6.7 Progress Trends & Charts
- Per-exercise progress chart: load and/or reps over time (e.g. top set weight for Bench Press across sessions), scoped appropriately by set type (reps-based exercises chart weight/reps, duration-based chart time, distance-based chart distance).
- Run progress charts: pace, distance, and duration over time.
- Training volume/frequency view: workouts per week, sessions by type, over a selectable time range (e.g. last 4/12 weeks).
- Difficulty rating trend over time, so the user can see whether workouts are consistently landing too easy/too hard vs. about right.
- Charts are viewable from both the workout history view and from an exercise's entry in the exercise library (to see that exercise's history specifically).

## 7. Non-Functional Requirements

- **Data persistence:** hosted database; user data must survive across sessions/devices, not just be stored in the browser.
- **Security:** user data is private per-account; passwords hashed; standard auth best practices (session/token expiry, no plaintext secrets).
- **AI cost/latency awareness:** LLM calls (workout generation, image parsing) should have reasonable response times and the app should handle API failures gracefully (e.g. show an error and let the user retry or enter data manually rather than blocking them).
- **Responsive design:** usable on both desktop and mobile browsers, since workout logging often happens mid-gym on a phone.

## 8. Data Model (Initial Sketch)

- **User**: id, email, password hash, created_at
- **Exercise** (per-user library): id, user_id, name, default muscle group (optional), default set type (reps / duration / distance)
- **WorkoutSession**: id, user_id, date, type (strength / run), label, warmup_notes, finisher_notes, cooldown_notes, energy_rating (1–10, optional), difficulty_rating (1–5, "Too Easy"–"Too Hard", optional), difficulty_note (optional), goal_for_next (optional), source (manual / ai_generated), created_at
- **WorkoutBlock**: id, session_id, order, round_count, rest_seconds (optional) — a block groups one or more exercises done together for N rounds; a single-exercise, 1-round block is just a normal exercise
- **WorkoutExercise**: id, block_id, exercise_id, order, note_for_next_time (optional)
- **Set**: id, workout_exercise_id, round_number, set_type (reps / duration / distance), reps (nullable), weight (nullable), weight_unit (nullable), duration_seconds (nullable), distance_meters (nullable)
- **Run**: id, session_id, distance, duration, pace, screenshot_url, raw_extracted_data (json)

This is a starting point for engineering design, not final schema.

## 9. Suggested Tech Direction

Given a hosted, multi-user web app with LLM text + vision calls:

- **Frontend:** a modern web framework (e.g. React/Next.js) for a responsive SPA.
- **Backend:** a lightweight API server (e.g. Next.js API routes, or a separate Node/Python service) handling auth, CRUD, and orchestrating LLM calls.
- **Database:** hosted relational DB (e.g. Postgres, via a managed provider) for user, workout, and exercise data.
- **AI:** an LLM with both text and vision capability for (a) workout generation from history + free-text feeling, and (b) extracting run stats from uploaded screenshots.
- **File storage:** object storage (e.g. S3-compatible) for uploaded screenshots.
- **Charting:** a frontend charting library (e.g. Recharts, Chart.js) for progress trends (Section 6.6).

Final stack choice is an engineering decision to be made at implementation time; this section is a directional recommendation, not a hard requirement.

## 10. Open Questions / Future Considerations

- Should the app eventually integrate directly with the Strava API (OAuth) instead of screenshot upload, to reduce manual steps? (Explicitly out of scope for v1 per Section 3.)
- Should AI-generated workouts learn from what the user actually completed vs. what was suggested, over time (adaptive suggestions)? Partially addressed by the difficulty-rating feedback loop (6.2, 6.4) — open question is how aggressively/automatically the LLM should act on it vs. just surfacing the trend for the user to consider.
- Should there be reminders/notifications (e.g. "you haven't logged a workout in 3 days")?
- Units: kg vs lb, and metric vs imperial for runs — confirm default and whether it's user-configurable.
- Should workout templates/plans (multi-day programs) be supported, or is each session generated independently?

## 11. Success Metrics

- User replaces their ChatGPT-copy-paste workflow entirely with in-app generation (qualitative: "I stopped going to ChatGPT separately").
- Time to log a completed workout session is faster than the current manual process.
- Run screenshot extraction is accurate enough that manual correction is rare (target: minimal edits needed on extracted fields).
