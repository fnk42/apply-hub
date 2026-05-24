## Plan

1. **Keep the OAuth callback on the login route**
   - Change Google sign-in to use a callback URL like `/login?redirect=/portal` instead of sending the OAuth return directly to `/portal`.
   - This lets the `lovable.auth.signInWithOAuth()` flow finish on the login page and store the new session before protected routes run.

2. **Make login wait for a restored session**
   - On `/login`, check `supabase.auth.getSession()` first, then `getUser()` only after a session exists.
   - Once authenticated, navigate to the requested `redirect` target or `/portal`.
   - Avoid redirecting too early while incognito storage/session restoration is still settling.

3. **Avoid unsafe redirect targets**
   - Normalize the `redirect` query param so only same-site paths like `/portal` are used.
   - Fall back to `/portal` for missing, external, or malformed values.

4. **Preserve the protected route checks**
   - Keep `_authenticated` responsible for requiring a logged-in user.
   - Keep `_authenticated.portal` responsible for role access, but do not mask auth/session timing errors as permission denial.

## Technical details

The likely failure in incognito is that OAuth succeeds, but the app returns directly to `/portal` before the client session is reliably available to the protected route/server-function role check. The fix routes the OAuth callback back through `/login`, which is public and can safely complete session setup, then forwards to `/portal` after the session is confirmed.