## Diagnosis

Add Candidate's server function actually works — the DB shows a recent successful manual insert (`Joey Njau`, 10:01 today). So the form is reaching Supabase and inserting. The "stuck on Adding…" symptom is happening on the **client side around submit/navigation**, not server-side, and we currently have no visibility into the failure because:

- The submit handler swallows all errors into a `toast.error(err.message)`, but if the error has no `.message` (or is a thrown response object from a serverFn validation), the toast is generic / easy to miss.
- There is no `console.error` in the catch block, so nothing shows in DevTools.
- After a successful insert, we `navigate({ to: "/portal/$id", params: { id } })`. If the destination's loader (`getCandidate`) throws for any reason (e.g. RLS visibility lag right after insert, or a transient auth race), the navigation aborts, the form component stays mounted, and the button can appear "stuck" even though the row was created.

## Fix (small, focused, frontend-only)

Edit `src/routes/_authenticated.portal.jobs.$slug.add-candidate.tsx`:

1. **Make failures visible.** In the `catch` block of `handleSubmit`:
   - `console.error("createCandidate failed", err)` so we always have something in DevTools.
   - Build the toast message defensively: prefer `err?.message`, fall back to `String(err)`, then to `"Failed to add candidate"`. Show it for ~6s so it's not missed.
2. **Stop the "stuck button" failure mode.** Move `setSubmitting(false)` to run **before** `navigate(...)` on success, not after — currently it lives in `finally`, which fires after navigate has already started. If navigate fails (loader on `/portal/$id` rejects), the user is left on the form with `submitting=true` forever. Set it to `false` immediately after the server fn resolves, then call `navigate`. If navigate throws, the user can retry instead of being stuck.
3. **Tolerate immediate-read inconsistencies on the destination.** Wrap the post-insert navigate in a try/catch. If it throws (e.g. the new id isn't readable yet), fall back to `navigate({ to: "/portal/jobs/$slug", params: { slug } })` so the user lands on the job page where the new candidate will appear once the candidates query revalidates. Show a success toast either way.
4. **Trim+null defensively.** The handler currently sends empty strings for optional fields. The server validator already accepts them, but normalize to `null` in the client before sending so we never accidentally store `""` for `phone`, `linkedin_url`, `current_title`, `current_company`, `cover_note`. Purely a hygiene improvement.

No backend changes. No RLS changes. No schema changes. No changes to other routes.

## Verification

After the edit:
1. Open `/portal/jobs/business-manager/add-candidate`, fill name+email, submit.
   - Expected: button briefly says "Adding…", success toast shows, you land on either `/portal/<new-id>` or back on the job page.
2. Submit with the same email twice in a row.
   - Expected: still works (no unique constraint on email per ad), no stuck button.
3. Open DevTools → Console before clicking. If anything still fails, the `console.error` from step 1 will print the real error and we'll have a precise root cause to fix in the next pass.

## Files touched

- `src/routes/_authenticated.portal.jobs.$slug.add-candidate.tsx` only.
