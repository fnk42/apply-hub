## Add "Delete candidate" capability

### What

Let an admin permanently delete a candidate (application + their activity events + their uploaded resume file) from the candidate detail page.

### Why

Currently there's no way to remove test submissions, spam, duplicates, or candidates added by mistake. RLS already permits admins to delete applications — we just have no UI or server function for it.

### Scope

- Admins only (matches existing `admins delete applications` RLS policy).
- Hard delete: removes the `applications` row, its `application_events`, and the resume file in the `resumes` storage bucket if present.
- Trigger from the candidate detail page (`/portal/<job>/<id>`) with a confirmation dialog — no accidental deletes.

### Changes

1. **`src/lib/candidates.functions.ts`** — add `deleteCandidate` server function:
   - `requireSupabaseAuth` + admin role check (same pattern as `deleteClient`).
   - Look up the application to grab `resume_url` and `job_ad_id` (for cache invalidation hint on client).
   - Delete `application_events` for that application, delete the `applications` row, and best-effort delete the resume from the `resumes` bucket.
   - Return `{ ok: true, job_ad_id }`.

2. **`src/routes/_authenticated.portal.$id.tsx`** — add a "Delete candidate" button:
   - Place it in the header area next to the shortlist/fit controls, styled as `destructive` and visually de-emphasized (small, outline-destructive).
   - Wrap in `AlertDialog` (already in the design system) with title "Delete this candidate?", body explaining it's permanent and removes the resume + activity log, and a red "Delete permanently" confirm.
   - On confirm: call `deleteCandidate`, show toast, invalidate `["candidates"]`, and navigate back to the job ad page (using the candidate's `job_ad_id`) — or to `/portal/jobs` as a fallback.
   - Only render the button when the current user has the `admin` role. Source the role from the existing `getPortalShell` query that's already in cache (sidebar uses it), so no extra round-trip.

### Out of scope

- No "soft delete / archive" flow — user asked for delete, not archive. Can add later if needed.
- No bulk delete from the candidates list. Single-record delete from detail page only.
- No changes to RLS (already correct).
- No changes to the public apply form or resume download flow.

### Technical notes

- The `application_events` table has no FK cascade, so we delete events explicitly before the application row (same pattern `deleteClient` uses).
- Resume deletion is best-effort: if the storage call fails (file already gone, etc.) we still proceed with the DB delete and log the storage error server-side.
- Admin check uses `supabase` (user-scoped client from middleware) querying `user_roles`, matching the existing pattern in `deleteClient` / `createClient`.
