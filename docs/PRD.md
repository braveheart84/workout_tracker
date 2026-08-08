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
- Let the user log strength workouts: exercises, sets, reps, and load (weight).
- Let the user log runs by uploading a Strava screenshot, with run stats (distance, pace, duration, etc.) auto-extracted via AI vision rather than typed in by hand.
- Give the user a history/view of recent workouts so both they and the AI generator can see what's been trained recently.
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

## 6. Functional Requirements

### 6.1 Accounts & Auth
- Users can sign up, log in, and log out.
- Each user's workout data is private to their account.
- Password reset / basic account management.

### 6.2 AI Workout Generation
- User provides free-text input describing how they're feeling and/or what kind of session they want (e.g. "feeling tired, want something light" or "want to hit legs hard").
- The app automatically includes relevant recent workout history (e.g. last 7–14 days: workout type, muscle groups trained, dates) as context to the LLM — the user should not have to manually restate what they did.
- The LLM returns a structured workout suggestion: a list of exercises, each with suggested sets/reps (and target muscle group), and, for a run suggestion, a suggested type/duration/effort.
- The user can regenerate, edit, or accept the suggestion.
- Accepting a suggestion pre-fills a new workout log entry, which the user then completes as they train (see 6.3).

### 6.3 Strength Workout Logging
- Create a workout session (date, optional notes, optional label e.g. "Upper Body Strength").
- Add exercises to a session, each with one or more sets.
- Each set records: reps and load (weight + unit, kg/lb).
- Edit or delete exercises/sets within a session after creation.
- Exercises should be selectable from a reusable list (avoid re-typing "Bench Press" every time) — a personal exercise library that grows as the user logs new exercise names.

### 6.4 Run Logging via Screenshot
- User uploads a screenshot (e.g. from Strava).
- The app uses AI vision to extract run data from the image: distance, duration, pace, and date (whatever is visible/legible).
- Extracted data is shown to the user as an editable form before saving, so they can correct any misread values.
- The original screenshot is stored alongside the extracted data as a visual record.
- Saved runs appear in the same workout history/timeline as strength sessions.

### 6.5 Workout History
- Chronological list/timeline of past sessions (strength + runs).
- Each entry shows enough summary detail to be useful as AI-generation context and for the user to browse (date, type, key stats).
- Ability to view full detail of any past session.

## 7. Non-Functional Requirements

- **Data persistence:** hosted database; user data must survive across sessions/devices, not just be stored in the browser.
- **Security:** user data is private per-account; passwords hashed; standard auth best practices (session/token expiry, no plaintext secrets).
- **AI cost/latency awareness:** LLM calls (workout generation, image parsing) should have reasonable response times and the app should handle API failures gracefully (e.g. show an error and let the user retry or enter data manually rather than blocking them).
- **Responsive design:** usable on both desktop and mobile browsers, since workout logging often happens mid-gym on a phone.

## 8. Data Model (Initial Sketch)

- **User**: id, email, password hash, created_at
- **Exercise** (per-user library): id, user_id, name, default muscle group (optional)
- **WorkoutSession**: id, user_id, date, type (strength / run), label/notes, source (manual / ai_generated), created_at
- **WorkoutExercise**: id, session_id, exercise_id, order
- **Set**: id, workout_exercise_id, reps, weight, weight_unit
- **Run**: id, session_id, distance, duration, pace, screenshot_url, raw_extracted_data (json)

This is a starting point for engineering design, not final schema.

## 9. Suggested Tech Direction

Given a hosted, multi-user web app with LLM text + vision calls:

- **Frontend:** a modern web framework (e.g. React/Next.js) for a responsive SPA.
- **Backend:** a lightweight API server (e.g. Next.js API routes, or a separate Node/Python service) handling auth, CRUD, and orchestrating LLM calls.
- **Database:** hosted relational DB (e.g. Postgres, via a managed provider) for user, workout, and exercise data.
- **AI:** an LLM with both text and vision capability for (a) workout generation from history + free-text feeling, and (b) extracting run stats from uploaded screenshots.
- **File storage:** object storage (e.g. S3-compatible) for uploaded screenshots.

Final stack choice is an engineering decision to be made at implementation time; this section is a directional recommendation, not a hard requirement.

## 10. Open Questions / Future Considerations

- Should the app eventually integrate directly with the Strava API (OAuth) instead of screenshot upload, to reduce manual steps? (Explicitly out of scope for v1 per Section 3.)
- Should AI-generated workouts learn from what the user actually completed vs. what was suggested, over time (adaptive suggestions)?
- Should there be reminders/notifications (e.g. "you haven't logged a workout in 3 days")?
- Units: kg vs lb, and metric vs imperial for runs — confirm default and whether it's user-configurable.
- Should workout templates/plans (multi-day programs) be supported, or is each session generated independently?

## 11. Success Metrics

- User replaces their ChatGPT-copy-paste workflow entirely with in-app generation (qualitative: "I stopped going to ChatGPT separately").
- Time to log a completed workout session is faster than the current manual process.
- Run screenshot extraction is accurate enough that manual correction is rare (target: minimal edits needed on extracted fields).
