# Fix login and split URLs: /talentportal (private) vs /apply/:slug (public)

## What's actually wrong

1. **Login appears to "reject" credentials** because after a successful sign-in, `resolveDestination()` always sends you to `/portal/jobs/business-development-manager`. If your role can't see that ad (RLS), the portal layout still mounts but you land on a page that looks empty / bounces — so it *feels* like the password was wrong. There is no real auth failure here.
2. **It "goes back to the apply page"** because `/` is the apply landing and the login screen has a "← Back to apply page" link to `/`. The two surfaces are entangled.
3. **No URL separation** between the public application flow and the private client/staff portal. Everything authenticated lives under `/portal`.

## End state

- **Public (LinkedIn ad target):** `/apply/$slug` — unchanged, anonymous, no auth.
- **Private (client + GPR staff):** `/talentportal/...` — all authenticated pages move here.
- **Login:** `/login` — after sign-in, route by role with no hardcoded job slug.
- **`/portal/*`:** kept as thin redirects to `/talentportal/*` so old links and the in-app `<Link to="/portal/...">` calls keep working during the transition.

No DB changes. No new auth method. No change to the public apply flow.

## Guardrails (carry-over from previous plan)

- Auth gate stays in **one** place: `src/routes/_authenticated.tsx`. No child `beforeLoad` re-checks `isAuthenticated`.
- `_authenticated.tsx` keeps `ssr: false`.
- `/apply/$slug` and its anon-insert RLS policy are not touched.
- Login destination logic stays under ~30 lines and does **one** server-fn round trip (`getPortalShell()` already returns roles).
- No new packages, no edge functions, no email template changes.

## Steps (sequenced, minimal-edit)

### Step 1 — Simplify `login.tsx` (one file)

- Remove the hardcoded fallback `"/portal/jobs/business-development-manager"`.
- New `resolveDestination`:
  - If `redirect` search param is set and not `/portal*` → honor it.
  - Else call `getPortalShell()` once and route:
    - `admin` → `/talentportal/main`
    - `member` → `/talentportal/staff`
    - `client` → `/talentportal/client`
    - none → `/unauthorized`
- Collapse the two "forward when authenticated" effects into one effect that runs `goToDestination()` when a session exists.
- Change the "← Back to apply page" link to point to `/` only if the user actually came from `/apply/*` (otherwise hide it). This stops the visual impression that login always bounces to the apply page.
- Target: file stays under ~110 lines.

### Step 2 — Add the three landing routes

New, tiny files (each ~15 lines):

- `src/routes/_authenticated.talentportal.index.tsx` → redirects by role to `/talentportal/main | staff | client` (single `getPortalShell()` call, same shellQuery as the portal layout — cache hit, no extra round trip).
- `src/routes/_authenticated.talentportal.main.tsx` → admin dashboard placeholder (lists clients + active ads). Admin-only, redirect non-admins to `/talentportal/staff` or `/client`.
- `src/routes/_authenticated.talentportal.staff.tsx` → GPR member view (reuses existing jobs list). Members + admins.
- `src/routes/_authenticated.talentportal.client.tsx` → client view (reuses existing jobs list, read-only). Clients only.

Role checks use `context.queryClient.getQueryData(shellQuery)` from the parent layout — no extra fetch.

### Step 3 — Add `_authenticated.talentportal.tsx` layout

- Copy of the current `_authenticated.portal.tsx` (sidebar + header + `<Outlet />`), unchanged behavior.
- Same `shellQuery` and `beforeLoad` role check.

### Step 4 — Make `/portal/*` a thin redirect surface

- Replace `_authenticated.portal.index.tsx` with a redirect to `/talentportal`.
- Add `_authenticated.portal.$.tsx` (splat) that redirects `/portal/anything` → `/talentportal/anything`.
- **Do not** delete the existing `_authenticated.portal.*.tsx` files yet. The splat catches anything not matched by a more-specific route; the existing files keep working until Step 6. This avoids breaking ~15 internal `<Link to="/portal/...">` calls in one big edit.

### Step 5 — Update the apply page's "View portal" / login links

- In `apply.$slug.tsx` and `index.tsx` (the public landing), make sure any "Staff sign-in" / portal link goes to `/login` with no preset `redirect`, so role-based routing decides.
- Verify the LinkedIn share URL on the job detail page (`_authenticated.portal.jobs.$slug.tsx` line ~572) still writes `${origin}/apply/${slug}`. No change needed.

### Step 6 — (Deferred, optional) Move existing portal pages

Once Steps 1–5 are verified working, in a **separate** later turn:

- Rename `_authenticated.portal.<x>.tsx` → `_authenticated.talentportal.<x>.tsx` (15 files).
- Find/replace `to="/portal/` → `to="/talentportal/` and `to: "/portal/` → `to: "/talentportal/` in `src/`.
- Delete the `_authenticated.portal.$.tsx` redirect splat.
- Keep the typo fix ("MP Shah Hospital") for that same turn.

This step is intentionally **not** part of this prompt to keep the credit cost down and the blast radius small.

## Files touched in this turn

Edited (3):
- `src/routes/login.tsx`
- `src/routes/_authenticated.portal.index.tsx`
- `src/routes/apply.$slug.tsx` (only the login link, if present) and `src/routes/index.tsx` (only the staff link)

Created (5):
- `src/routes/_authenticated.talentportal.tsx`
- `src/routes/_authenticated.talentportal.index.tsx`
- `src/routes/_authenticated.talentportal.main.tsx`
- `src/routes/_authenticated.talentportal.staff.tsx`
- `src/routes/_authenticated.talentportal.client.tsx`
- `src/routes/_authenticated.portal.$.tsx` (redirect splat)

Auto-regenerated:
- `src/routeTree.gen.ts` (by Vite plugin, do not hand-edit)

Not touched: DB, RLS, server functions, `_authenticated.tsx`, all existing `_authenticated.portal.<page>.tsx` files, sidebar, candidates server fns.

## Verification

1. Sign out, hit `/login`, enter your `felix@goldenpipitrecruiting.com` credentials → should land on `/talentportal/main` (admin) without flashing the apply page.
2. Hit `/portal/jobs/business-development-manager` directly → redirects to `/talentportal/jobs/business-development-manager` and renders.
3. Hit `/apply/<a real slug>` while signed out → public form renders, no redirect.
4. Hit `/apply/<slug>` while signed in as admin → still renders the public form (no auth gate on `/apply`).
5. Refresh on `/talentportal/main` → no `/login` flash.

## What this does NOT do

- Does not create per-client subpaths like `/talentportal/<clientSlug>/...` — that needs the `clients.slug` DB column from the prior plan's Prompt 2 and can be added in a later turn.
- Does not build the central admin dashboard's real content — just the route shell.
- Does not move or rename existing portal pages (deferred to Step 6 above).
