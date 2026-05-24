
## Goal

A live job ad needs two things working end-to-end:
1. Candidates can apply from a public URL → land in the database against the right job.
2. The client (plus internal team) can log into the portal and see those candidates.

Internal team visibility already works. The two gaps are the public apply page and client access.

---

## Part 1 — Public apply page at `/apply/$slug`

Today the homepage (`/`) is a hardcoded apply form pointing at a placeholder `job_ad_id`. That can't go live.

**Build:**
- New route `src/routes/apply.$slug.tsx`: public (no auth), looks up the job ad by slug, only renders the form if `status = 'live'` (otherwise shows "this role is no longer accepting applications").
- Renders the job title, client name, and the screening questions for that ad.
- Posts to a new public server function `submitApplication` (no auth middleware) that inserts into `applications` with the correct `job_ad_id`, `source = 'public_form'`, default stage from `job_ad_stages`, and uploads the resume to the `resumes` bucket.
- Honeypot + basic validation, success screen with confirmation message.
- Homepage `/` becomes a simple "Find open roles" page listing all `status = 'live'` job ads linking to `/apply/$slug`. (Keeps the current marketing feel, just data-driven.)
- Each live job's "share link" surfaces in the portal on the job page (copy-to-clipboard) so you can hand it to the client / paste into LinkedIn.

## Part 2 — Client login + scoped visibility

Today clients have no way in. The `clients` table has an `auth_user_id` column but nothing uses it, and RLS on `job_ads`/`applications` is admin/recruiter/member only.

**Database changes (one migration):**
- Add `'client'` to the `app_role` enum.
- Add RLS policies:
  - `job_ads`: clients can SELECT rows where `client_id` matches a row in `clients` with their `auth_user_id`.
  - `applications`: clients can SELECT rows whose `job_ad_id` belongs to one of their jobs. Read-only (no insert/update/delete).
  - `job_ad_stages`, `clients` (own row): same scoping for read.
- Helper SQL function `is_client_for_job(_user uuid, _job_ad_id uuid)` to keep policies readable.

**Portal changes:**
- `getMyRoles` already exists; extend the portal gate in `_authenticated.portal.tsx` to allow `client` as well.
- New `getPortalShell` branch: if the user is a client, only return their own job ads.
- Hide internal-only UI for clients: add-candidate button, stage editor, activity feed, settings, recruiter notes, fit dropdown, pipeline status changes. Clients see: candidate name, applied date, shortlisted flag, resume link.
- `AppSidebar` hides admin/recruiter-only sections when role is `client`.

**Admin tooling:**
- On the client detail / settings page, add "Invite client" button that:
  1. Calls `supabase.auth.admin.inviteUserByEmail(clients.contact_email)` (admin server fn)
  2. Sets `clients.auth_user_id` to the new user id
  3. Inserts a `user_roles` row with `role = 'client'`
- Client receives a magic-link / set-password email and lands in the portal scoped to their jobs.

## Part 3 — Verify the live ad is actually ready

Quick checklist I'll run before shipping:
- Confirm the target `job_ads` row has `status = 'live'` and a valid `slug`.
- Confirm `job_ad_stages` has the four default rows (seed trigger exists; verify for this ad).
- Confirm `resumes` storage bucket allows anon upload (it's currently private — needs a public-insert policy scoped to anon, with read restricted to authenticated portal users via signed URL, which `getResumeSignedUrl` already handles).

---

## Files / surfaces touched

**New**
- `src/routes/apply.$slug.tsx` — public apply page
- `src/routes/_authenticated.portal.clients.tsx` (admin) — invite client button
- One Supabase migration — `client` role, RLS policies, helper function, storage policy

**Edited**
- `src/routes/index.tsx` — replace hardcoded form with list of live roles
- `src/lib/candidates.functions.ts` — add `submitApplication` (public), `inviteClient` (admin), branch `getPortalShell` by role
- `src/routes/_authenticated.portal.tsx` — allow `client` role
- `src/routes/_authenticated.portal.jobs.$slug.tsx` — add share link, hide internal controls for clients
- `src/components/portal/AppSidebar.tsx` — role-aware nav

## What I'll need from you

- Confirm the slug of the job ad you want to go live with so I can sanity-check it before/after.
- The client's contact email (or confirm `clients.contact_email` is already set for that client) so the invite goes to the right address.

## Out of scope (parking lot)

- Email notifications to client / candidate on new application (mentioned earlier — happy to follow up).
- Fixing the broken internal "Add candidate" button (still parked per your last message).
