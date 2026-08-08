# Technology Stack: Workout Tracker

**Status:** Draft
**Owner:** hasyim.az@gmail.com
**Last updated:** 2026-08-08
**Related:** [PRD.md](./PRD.md)

This document details the technology stack chosen to build the Workout Tracker described in the PRD — a hosted, multi-user, installable PWA that logs strength/run workouts and uses an LLM for both workout generation and screenshot data extraction. It supersedes the directional notes in PRD Section 10 with concrete choices.

## 1. Overview

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Route Handlers (same codebase as frontend) |
| Database | PostgreSQL (managed, e.g. Neon or Supabase) via Prisma ORM |
| Auth | Auth.js (NextAuth) with credentials provider |
| File storage | S3-compatible object storage (e.g. Cloudflare R2 or Supabase Storage) |
| LLM (text + vision) | Anthropic Claude API |
| Charting | Recharts |
| PWA | `@ducanh2912/next-pwa` (manifest + service worker) |
| Hosting | Vercel |

A single TypeScript codebase (Next.js) covers frontend and backend, which keeps a solo/small-team build simple: one deploy target, one language, shared types between client and server.

## 2. Frontend

- **Framework:** Next.js (App Router), React, TypeScript.
- **Styling/components:** Tailwind CSS + shadcn/ui for a consistent, accessible component set without building a design system from scratch.
- **Charts:** Recharts, for the progress trend charts in PRD 7.8 (load/rep progression, run pace/distance, volume, difficulty trend).
- **PWA:** `@ducanh2912/next-pwa` (actively maintained Next.js PWA plugin) generates the service worker and wires up the web app manifest, satisfying PRD Section 8's installability requirement — app shell/icons cached, home-screen install, full-screen launch.
- **State/data fetching:** React Query (TanStack Query) for server-state caching and optimistic updates — useful for the low-friction logging loop in PRD 7.4, where set entries should feel instant even while syncing to the backend.
- **Forms:** React Hook Form + Zod for the various logging/edit forms (sets, run screenshot correction, exercise library entries), with Zod schemas shared with the backend for validation.

## 3. Backend

- **Framework:** Next.js Route Handlers (`app/api/**`), running as Vercel serverless functions. No separate backend service — keeps auth, CRUD, and LLM orchestration in the same codebase and deploy pipeline as the frontend.
- **Language:** TypeScript throughout, sharing types (e.g. the workout/session/set shapes from PRD Section 9) between API handlers and frontend components.
- **Validation:** Zod schemas at every API boundary (request bodies, LLM response parsing) — LLM output in particular should never be trusted without validation before it hits the database.
- **Jobs/background work:** none required for v1 (no queues); if reminders/notifications (PRD Section 11 open question) are built later, Vercel Cron is the natural fit given the rest of the stack.

## 4. Database

- **Engine:** PostgreSQL — relational fits the nested structure in PRD Section 9 well (`WorkoutSession` → `WorkoutBlock` → `WorkoutExercise` → `Set`), and gives real transactions when saving a full generated plan or a completed workout in one go.
- **Hosting:** a managed serverless Postgres provider — **Neon** (generous free tier, branching for preview environments, scales to zero when idle) or **Supabase** (Postgres + built-in Storage + Auth, if consolidating vendors is preferred — see Section 6/7 alternatives). Either satisfies PRD Section 8's "hosted database, survives across devices" requirement.
- **ORM:** Prisma — typed queries and migrations matching the schema sketch in PRD Section 9, straightforward to evolve as the schema firms up during implementation.
- **Schema mapping:** the Prisma schema follows PRD Section 9 directly: `User`, `Exercise`, `WorkoutPlan`, `WorkoutSession`, `WorkoutBlock`, `WorkoutExercise`, `Set`, `Run`.

## 5. LLMs

- **Provider:** Anthropic Claude API, for both capabilities the PRD requires from a single vendor:
  - **Text generation (PRD 7.2):** workout suggestions — single-day or multi-day — generated from recent history, free-text input, and the difficulty-rating trend. Structured output (JSON matching the block/exercise/set shape) via tool use / a JSON schema, validated with Zod before being shown to the user or saved.
  - **Vision (PRD 7.6):** extracting distance/duration/pace/date from an uploaded Strava screenshot, returned as structured JSON and shown to the user as an editable form before saving.
- **Model tier:** a mid-tier Claude model (e.g. Sonnet) for both text and vision calls — strong enough for structured reasoning over workout history and reading screenshot text, without the cost of the largest tier for what are fairly bounded tasks. Model choice is easy to revisit later since both call sites go through a single thin wrapper.
- **Reliability:** per PRD Section 8's AI cost/latency requirement — API calls are wrapped with a timeout and a single retry; on failure, the user sees an error and can retry or fall back to manual entry (manual workout creation, manual run entry) rather than being blocked.
- **Exercise how-to links (PRD 7.4, nice-to-have):** if the app auto-attaches a how-to reference when a new exercise appears in a generated suggestion, that also goes through Claude (asked for a known instructional source), with the generated-YouTube-search-link fallback in the PRD covering the case where none is available — no separate search API needed for v1.

## 6. File Storage

- **Choice:** S3-compatible object storage for uploaded Strava screenshots (PRD 7.6), which are stored alongside the extracted data as a visual record.
- **Recommendation:** Cloudflare R2 (S3-compatible API, no egress fees) or Supabase Storage (bundled with the DB choice, simpler if consolidating on Supabase). Either integrates cleanly with the Next.js backend via a presigned-upload flow, so screenshots go straight from the browser to storage rather than through the API server.

## 7. Auth

- **Library:** Auth.js (formerly NextAuth), credentials provider (email + password) per PRD 7.1.
- **Password handling:** bcrypt hashing, never stored/logged in plaintext, matching PRD Section 8's security requirement.
- **Sessions:** JWT-based sessions (fits serverless deployment on Vercel without a sticky session store) with reasonable expiry, per PRD Section 8.

## 8. Hosting & Deployment

- **Platform:** Vercel — first-class Next.js support (frontend + API routes deploy as one unit), automatic preview deployments per branch/PR, and edge caching for the PWA app shell.
- **Environments:** production + preview deployments; database branching (if using Neon) to give each preview its own isolated data.

## 9. Alternatives Considered

| Decision | Chosen | Alternative(s) considered | Why not (for now) |
|---|---|---|---|
| Backend architecture | Next.js Route Handlers (monolith) | Separate Node/Python service | Extra deploy target and network hop not justified at this scale; PRD's own Section 10 already flagged this as an option, but a single codebase is simpler for v1 |
| Database host | Neon / Supabase | Self-managed Postgres (e.g. on a VPS) | Managed hosting removes backup/patching burden for a small-team project |
| LLM provider | Anthropic Claude | OpenAI (GPT + vision) | Comparable capability for this use case; Claude chosen to keep a single-vendor integration — revisit if cost/quality differs materially in practice |
| Auth | Auth.js | Managed auth (Clerk, Supabase Auth) | Auth.js keeps auth in the same codebase/DB rather than adding a vendor; can migrate to a managed provider later without changing the data model |

## 10. Open Questions

- Neon vs. Supabase for the database: Supabase would also cover file storage and could cover auth, consolidating vendors at the cost of some flexibility — worth deciding before implementation starts rather than during it.
- Confirm Claude model tier (and fallback behavior) once real usage/cost data exists from early testing.
- If push notifications are built later (PRD Section 11), confirm Vercel Cron + Web Push is sufficient, or whether a dedicated notification service is warranted.
