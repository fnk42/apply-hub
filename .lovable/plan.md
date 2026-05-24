## Plan

Fix the manual **Add candidate** flow so it can’t stay stuck on “Adding…” indefinitely.

### What I’ll change

1. **Use the proper React server-function call pattern**
   - Wrap `createCandidate` with `useServerFn(createCandidate)` inside the add-candidate page component.
   - Call that wrapped function from `handleSubmit` instead of calling the server function directly.

2. **Guarantee the button always unsticks**
   - Put `setSubmitting(false)` in a true `finally` block for the create step.
   - Add a short timeout guard around the server-function call, so if the request never resolves the UI shows an error instead of spinning forever.

3. **Improve validation and error visibility**
   - Fix the `orNull` helper so empty optional fields are sent as `null` rather than empty strings where appropriate.
   - Keep the existing `console.error("createCandidate failed", err)` and show a clear toast when the request fails or times out.

4. **Keep navigation fallback**
   - On success, invalidate job/candidate queries, show the success toast, and navigate to the new candidate.
   - If that navigation fails, fall back to the job page.

### Files to touch

- `src/routes/_authenticated.portal.jobs.$slug.add-candidate.tsx`

No database, auth, RLS, or schema changes are needed.