## Goal

Nobody should ever see the public `gptalentportal.com/` "Open roles" page again. It's the page Dickson landed on after clicking his invite, and it's also where stray traffic ends up. The apply links (`/apply/$slug`) keep working as direct deep links — candidates with a form URL go straight to the form.

## Behavior after change

- **`/` (root)** — no longer renders the Open roles list. Instead it redirects:
  - Not signed in → `/login`
  - Signed in as **admin** → `/main` (admin dashboard, current behavior)
  - Signed in as **member** → `/staff/candidates` (which already auto-opens the first live job ad)
  - Signed in as **client** → `/client` (which already auto-opens their first live ad)
  - Signed in but no role → `/unauthorized`
- **`/apply/$slug`** — unchanged. Candidates with a direct form URL go straight to the form, no detour.
- **`/login`** — unchanged. After sign-in the existing role-router in `login.tsx` already sends each role to the right surface.
- **`/portal`** — unchanged (already role-routes the same way).

## Change

Rewrite `src/routes/index.tsx` so the route is purely a redirect — no UI, no loader for live ads, no "Staff sign in" footer. Use a `beforeLoad` that:

1. Calls `supabase.auth.getUser()`.
2. If no user → `throw redirect({ to: "/login" })`.
3. If user → call `getPortalShell()` to get roles, then redirect to the role's home (`/main`, `/staff/candidates`, `/client`, or `/unauthorized`).

Drop the `head()` meta for "Open roles" since the page no longer exists as a public surface. Keep the file (TanStack needs a route at `/`), but the component becomes `() => null`.

## Why this also fixes the invite issue

Supabase invite/recovery links land on the site root with a `#access_token=…` hash, then the client redirects. Today that redirect target is `/` itself, which renders Open roles — explaining Dickson's screenshot. After this change:
- The hash session is picked up by the Supabase client on load.
- `/` immediately role-routes the now-signed-in user into the portal.
- For brand-new invitees (no password set yet), the existing `/reset-password` page is still the explicit `redirectTo` we pass in `resendInternalInvite`, so they land there directly from the invite email and set a password — they never hit `/`.

## Files

- `src/routes/index.tsx` — replace contents with a redirect-only route (no UI, no live-ads query, no footer link).

## Out of scope

- No changes to `/apply/$slug`, `/login`, `/portal`, `/main`, `/staff`, `/client`, or any admin functionality.
- No changes to the invite email, reset-password page, or email hook.
- The `listLiveJobAds` server function stays — it's still used by the portal shells.
