## Problem

Google OAuth succeeds (auth logs confirm `Login` events returning 200), but the user lands back on `/login`. The OAuth flow is fine — the post-auth routing logic is looping.

Two compounding bugs:

1. **`src/routes/login.tsx`** ignores the `?redirect=` query param and hardcodes the destination to `/portal`. It also doesn't detect an already-active session, so if the user lands back on `/login` with a valid session (e.g. after an OAuth round-trip), nothing forwards them on.

2. **`src/routes/_authenticated.portal.tsx`** wraps `getMyRoles()` in a `try/catch` that treats *any* thrown error as "unauthorized" and redirects to `/unauthorized`. A transient `Unauthorized` from the first server-fn call after OAuth hydration (before the bearer token is attached) gets misclassified, bouncing the user back out and ultimately back to `/login`.

## Changes

### 1. `src/routes/login.tsx`
- Add `validateSearch` to type the optional `redirect` param.
- On mount, call `supabase.auth.getUser()`. If a session exists, immediately navigate to `search.redirect ?? "/portal"`.
- In the email and Google success handlers, navigate to `search.redirect ?? "/portal"` instead of hardcoded `/portal`.
- Use the same value for the Google `redirect_uri` so the OAuth round-trip lands on the originally-requested page.

### 2. `src/routes/_authenticated.portal.tsx`
- Remove the blanket `catch → redirect("/unauthorized")`. Only redirect to `/unauthorized` when `getMyRoles()` returns successfully and the role set lacks `admin`/`recruiter`/`member`.
- Let auth/network errors propagate to the error boundary (which already offers a Try Again button), instead of masking a hydration race as a permission denial.

### 3. No other changes
- `src/routes/_authenticated.tsx` already awaits `supabase.auth.getUser()` correctly and preserves the originally-requested URL in `?redirect=` — no change needed.
- No database, server function, or OAuth provider configuration changes.

## Verification

1. Sign out, then visit `/portal/jobs/business-manager` directly while logged out → redirected to `/login?redirect=/portal/jobs/business-manager`.
2. Click "Continue with Google" → after Google round-trip, land on `/portal/jobs/business-manager` (not `/login`, not `/portal`).
3. While signed in, manually visit `/login` → immediately forwarded to `/portal`.
4. Email/password sign-in honors the same `redirect` param.
