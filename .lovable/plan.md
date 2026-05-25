## Three small changes

### 1. Clients land on the BD Manager job page after sign-in
- **`src/routes/login.tsx`** — After successful auth (email/password submit + post-Google `onAuthStateChange` path), call `getMyRoles()` and route:
  - `admin` or `member` → `/portal`
  - `client` only → `/portal/jobs/business-development-manager`
  - otherwise → `/unauthorized`
- **`src/routes/_authenticated.portal.index.tsx`** — Add a `beforeLoad` safety net: if the signed-in user is client-only, redirect to `/portal/jobs/business-development-manager`. Covers clients who land on `/portal` directly (e.g. sidebar logo).

### 2. Add "Medium fit" tab on the job ad page
- **`src/routes/_authenticated.portal.jobs.$slug.tsx`** —
  - Widen tab state union to `"all" | "strong" | "medium" | "shortlist"`.
  - Add `mediumCount = all.filter(c => c.fit === "medium").length`.
  - Extend the row filter: `if (tab === "medium" && c.fit !== "medium") return false;`.
  - Insert a `<TabsTrigger value="medium">Medium fit <count></TabsTrigger>` between Strong fit and Shortlist.
- Order ends up: **All candidates · Strong fit · Medium fit · Shortlist**.

### 3. Fix LinkedIn links opening with `ERR_BLOCKED_BY_RESPONSE`
- The candidate LinkedIn anchors use `target="_blank" rel="noreferrer"`. Inside the Lovable preview iframe, popups without `noopener` inherit cross-origin isolation and LinkedIn's response gets blocked.
- **Fix:** change `rel="noreferrer"` to `rel="noopener noreferrer"` on:
  - `NameCell` in `src/routes/_authenticated.portal.jobs.$slug.tsx`
  - LinkedIn link in `src/routes/_authenticated.portal.$id.tsx`
  - `linkedin_job_url` anchor in the job header (consistency)

No schema/RLS changes.
