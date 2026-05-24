## Plan

1. **Stop hard-reloading after successful sign-in**
   - Replace `window.location.href = destination` in `src/routes/login.tsx` with TanStack Router client navigation.
   - This keeps the newly stored browser session available while navigating to `/portal`.

2. **Use the same client navigation for already-signed-in users**
   - When `/login` detects an existing valid session, navigate in-app instead of forcing a document reload.
   - This prevents the protected route from being checked during SSR without access to the browser session.

3. **Keep OAuth callback behavior from the prior fix**
   - Continue returning Google OAuth to `/login?redirect=/portal` first.
   - After `/login` confirms the session, forward via client navigation.

4. **Verify the login page and routing behavior**
   - Confirm `/login?redirect=/portal` renders.
   - Check browser console/dev logs for route or dynamic import errors after the change.

## Technical details

The current code signs the user in successfully, then uses `window.location.href` to open `/portal` as a brand-new page load. On that first server-rendered request, the server cannot read the browser-only auth session yet, so `_authenticated` sends the user back to `/login`. Client-side navigation avoids that SSR/session mismatch.