## Goal

1. Turn off Google sign-in entirely — login is email/password via invite link only.
2. Lock down the portal so that **only admins** see anything other than the Business Development Manager candidates tab. Clients and members both land on `/portal/jobs/business-development-manager` and have no UI to navigate elsewhere.

---

## 1. Remove Google sign-in

**Backend (auth provider)**
- Call `supabase--configure_social_auth` with `providers: []` and `disable_providers: ["google"]` so the Google provider is turned off at the auth layer. Email/password stays enabled.

**Frontend (`src/routes/login.tsx`)**
- Remove the `googleLoading` state, the `handleGoogle` function, the "Continue with Google" button, and the "or email" divider.
- Drop the now-unused `lovable` import.
- Keep the existing email/password form and the invite-only notice unchanged.

We do **not** delete `src/integrations/lovable/index.ts` — it is auto-generated and harmless when unused.

---

## 2. Restrict non-admin users to the BDM tab

Current behavior: clients see all `live` job ads in the sidebar; internal members see all groups plus Activity / Clients / Admin / Settings. We want **only admins** to see anything beyond the single BDM job.

**`src/components/portal/AppSidebar.tsx`**
- Treat anyone who is not `admin` (clients *and* members) as "restricted":
  - Filter `ads` down to just the one whose slug is `business-development-manager` (fall back to the first `live` ad if for some reason that slug is missing).
  - Hide the group label.
  - Hide the Activity Log, Clients, Admin, and Settings menu items. (Today these are gated on `isInternal` / `isAdmin`; tighten so the whole bottom group only renders when `isAdmin === true`.)
- Admins keep the full sidebar exactly as it is today.

**Default landing route (`src/routes/_authenticated.portal.index.tsx` and `login.tsx`'s `resolveDestination`)**
- Already redirects everyone with a portal role to `/portal/jobs/business-development-manager`. Leave that as-is; it now matches the locked-down sidebar.

**Server-side guard (defense in depth) — `src/routes/_authenticated.portal.jobs.$slug.tsx`**
- In `beforeLoad`, fetch the user's roles via `getMyRoles()`. If the user is not `admin` and the requested `slug !== "business-development-manager"`, `throw redirect({ to: "/portal/jobs/$slug", params: { slug: "business-development-manager" } })`.
- This prevents a client or member from reaching another job tab by typing the URL directly, even though the sidebar no longer links there.

**Admin-only routes already protected by role checks** (Activity, Clients, Admin, Settings) — verify each route file has a `beforeLoad` that redirects non-admins to `/portal/jobs/business-development-manager` (today some use `isInternal`). Update any that allow `member` to be admin-only.

---

## Out of scope

- No changes to invite flow, email templates, or `SITE_NAME` (that's the separate naming decision still pending).
- No DB schema changes; role data already lives in `user_roles`.
- The `lovable` OAuth helper file stays in place (auto-generated).

## Verification after build

1. Visit `/login` — only email/password form is shown; no Google button.
2. Sign in as a client → land on BDM tab; sidebar shows only that one job; no Activity / Clients / Admin / Settings.
3. Manually visit `/portal/jobs/<other-slug>` as a client → redirected back to BDM tab.
4. Sign in as admin → full sidebar with all groups and admin tabs intact.
