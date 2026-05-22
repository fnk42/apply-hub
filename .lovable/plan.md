# Prompt 2 — Recruiter Portal + LinkedIn fix

## Scope

Build the authenticated recruiter side of the app, plus a small fix to the public form. Public apply page (Prompt 1) is untouched except for the LinkedIn field.

## Fix on the public form (`src/routes/index.tsx`)

- Change `linkedin_url` Zod rule from `.url()` + `linkedin.com` regex to a plain free-text string, required, max 255 chars.
- Update input: drop `type="url"`, keep placeholder as a hint ("LinkedIn URL or handle").
- Label stays "LinkedIn URL *".

## Auth

- Enable email/password + Google sign-in (Google via Lovable broker + `configure_social_auth`).
- Do NOT enable email auto-confirm.
- No `profiles` table — recruiter identity lives in `auth.users` + `user_roles`.
- First user to sign up gets seeded as `admin` via a one-shot SQL insert after they create their account (instructions surfaced on the login page until a recruiter exists). Future role grants happen by admin from `/portal/settings` (Prompt 3).
- Root route wires `onAuthStateChange` once → `router.invalidate()` + `queryClient.invalidateQueries()`.

## Routes

```
/login                          → public, email+password + Google button
/_authenticated/                → layout: beforeLoad checks session, redirects to /login
  portal/                       → layout: beforeLoad asserts is_recruiter_or_admin, else /unauthorized
    index.tsx                   → candidates table
    new.tsx                     → manual add form
    $id.tsx                     → candidate detail
/unauthorized                   → public, "you're signed in but not a recruiter"
```

`/` (public apply) stays outside `_authenticated`.

## Server functions (`src/lib/candidates.functions.ts`)

All use `requireSupabaseAuth`. RLS already restricts to recruiters.

- `listCandidates({ search?, fit?, pipeline_status? })` — returns `applications` ordered by `created_at desc`.
- `getCandidate({ id })` — returns application + `application_events` (timeline).
- `createCandidate(payload)` — manual add, `source: 'manual'`.
- `updateCandidate({ id, patch })` — patch `fit | pipeline_status | recruiter_notes`. Triggers already log events.
- `getResumeSignedUrl({ path })` — 60s signed URL from `resumes` bucket via `supabaseAdmin`.

`src/start.ts` already has `attachSupabaseAuth` — verify and keep.

## UI

Brand stays current navy/gold (Pipit black/yellow swap is a separate follow-up).

### `/login`
- Centered card. Email + password fields. "Sign in with Google" button above.
- Link to `/` ("Back to apply page").

### `/portal` (candidates list)
- Sticky top bar: Pipit logo, user email, sign-out.
- Left: search box (name/email), filter dropdowns for Fit + Pipeline Status. "+ Add candidate" button → `/portal/new`.
- Table columns: Name · Email · Source · Fit (badge) · Pipeline Status (badge) · Created. Row click → `/portal/:id`.
- Empty state with CTA to add a candidate.
- Uses TanStack Query (`queryOptions` + `ensureQueryData` in loader, `useSuspenseQuery` in component).

### `/portal/new`
- Same fields as public form but all optional except `full_name` + `email`. No screening questions, no resume required (optional upload).
- Stores `source: 'manual'`, `screening_answers: {}`.

### `/portal/:id` (detail)
Two-column layout on desktop, stacked on mobile:

**Left:** candidate facts (name, email, phone, LinkedIn link, source, created). Resume download button (calls `getResumeSignedUrl`). Screening answers rendered read-only.

**Right:**
- Fit selector: 4 pill buttons (Unrated / Weak / Medium / Strong). Click writes immediately.
- Pipeline Status: dropdown (Sourced / Scheduled for Interview / Rejected at Screening / Candidate Declined). Writes immediately.
- Recruiter Notes: free-form textarea, "Save" button (debounced toast on success).
- Activity Log: reverse-chronological list from `application_events`, showing `event_type`, `from_value → to_value`, `actor_email`, `created_at`.

### Components
- `src/components/portal/CandidateTable.tsx`
- `src/components/portal/FitBadge.tsx` (color-coded)
- `src/components/portal/StatusBadge.tsx`
- `src/components/portal/ActivityTimeline.tsx`

## Migration

One small migration: trigger to auto-log `created` event on insert into `applications` (already exists per Prompt 1 — verify; if missing, add). No schema changes otherwise.

## Out of scope (deferred to Prompt 3 / Claude)

- Pipit black/yellow palette swap
- Radio → segmented pill restyle
- `/portal/settings` (invite recruiters, manage roles)
- CSV export, bulk actions
- Email notifications, server-side validation on `/api/public/applications`
- `CLAUDE.md` + `docs/design-system.md` scaffolding

## Tech notes

- All portal data access goes through `createServerFn` + `requireSupabaseAuth` — no direct `supabase.from(...)` in components.
- Resume signed URLs use `supabaseAdmin` server-side only.
- `_authenticated` layout does sync auth check; portal child routes add `beforeLoad` that awaits `supabase.auth.getUser()` before loader runs.
- After login, role check happens in `/portal` layout `beforeLoad` via a `getMyRoles` server fn; non-recruiters get redirected to `/unauthorized`.