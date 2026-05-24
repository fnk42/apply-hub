# Fix "Failed to fetch" on public apply form

## Root cause

In `src/routes/apply.$slug.tsx`, the applicant's browser uploads the resume
**directly** to `https://<project>.supabase.co/storage/v1/object/resumes/...`
via `supabase.storage.from("resumes").upload(...)`.

Many applicants are on mobile networks, Brave/DuckDuckGo, corporate Wi-Fi, or
have ad/tracker blockers installed. The hostname `*.supabase.co` is on
several popular blocklists (EasyPrivacy, AdGuard Tracking Protection, etc.).
When that happens, the upload request is killed before it leaves the device
and the browser reports a generic **"Failed to fetch"** — exactly what the
screenshot shows. The form submit never runs because the upload throws first.

This is the same family of bug as the "view resume" `ERR_BLOCKED_BY_CLIENT`
issue we already fixed — except on the applicant side, where we cannot ask
people to disable extensions or switch browsers.

## Fix

Route the upload through our **own** domain (`gptalentportal.com` /
`*.lovable.app`) so the applicant's browser never contacts `supabase.co`.

### 1. New public server function — `uploadPublicResume`

In `src/lib/candidates.functions.ts`, add a `createServerFn({ method: "POST" })`
(no auth middleware — public, called from the apply page):

- Input (Zod-validated):
  - `job_ad_id: string (uuid)` — verify the ad is `live` before accepting bytes
  - `filename: string` (≤200 chars, sanitized)
  - `content_type: string` — must be one of the 3 allowed MIME types
  - `size: number` — must be ≤ 10 MB
  - `data_base64: string` — the file bytes, base64-encoded
- Handler:
  - Re-verify MIME / size / ad status server-side (do not trust the client).
  - Decode base64 → `Uint8Array`.
  - `supabaseAdmin.storage.from("resumes").upload(path, bytes, { contentType, upsert: false })`
    where `path = public/${crypto.randomUUID()}.${ext}`.
  - Return `{ path }`.

This uses `supabaseAdmin` (service-role, server-only) — identical trust model
to what the existing public `submitApplication` already does for the DB insert.

### 2. Update `src/routes/apply.$slug.tsx`

In `handleSubmit`:

- Remove the direct `supabase.storage.from("resumes").upload(...)` call.
- Read `resumeFile` as an `ArrayBuffer`, base64-encode it, and call
  `uploadPublicResume({ data: { ... } })` instead.
- Use the returned `path` as `resume_path` when calling `submitApplication`
  (unchanged).
- Keep all existing client-side validation (size/MIME) as a fast pre-check;
  the server re-validates.

The applicant's browser now only ever talks to our own origin, which
no blocker filters. The base64 payload travels inside a normal POST to
`/_serverFn/...` on `gptalentportal.com`.

### 3. (Defensive) Bump request body limit awareness

10 MB base64-encoded is ~13.4 MB on the wire. This is well within the
TanStack Start / Cloudflare Worker request body limits (100 MB), so no
config change is needed. Noted only so we don't get surprised later.

## What this does NOT change

- No DB schema changes.
- No RLS changes (we already use `supabaseAdmin` for the public submit).
- No changes to the recruiter portal, auth, or the resume-view proxy we
  shipped earlier.
- The apply form UX is identical — same fields, same validation, same
  success screen. Only the network path for the resume bytes changes.

## How we'll verify

1. Open `/apply/<slug>` in an Incognito Brave window (Brave Shields on) —
   should now submit successfully.
2. Open in Firefox with uBlock Origin enabled — should submit.
3. Check Network tab: there should be **zero** requests to
   `*.supabase.co` from the apply page. All traffic stays on
   `gptalentportal.com`.
4. New row appears in `applications` and the resume is downloadable from
   the recruiter portal (which already uses the server-side proxy).
