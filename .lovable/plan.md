## Prompt 3 — Routing: `/main`, `/staff`, `/client` surfaces

**Goal:** Introduce the new surface routes (`/main`, `/staff`, `/client`) as thin redirect/layout wrappers, and make `/portal` role-aware so it sends users to the right surface on login.

**Why this ordering:** The new routes act as thin shims that redirect to existing pages. In Prompt 4, the actual pages will be moved under these routes. This avoids breaking any live URLs during the transition.

---

### New files (thin wrappers/redirects)

1. **`src/routes/_authenticated.main.tsx`**
   - Role gate: `admin` only (admins see `/main`)
   - Layout with `<AppSidebar />` + `<Outlet />`

2. **`src/routes/_authenticated.staff.tsx`**
   - Role gate: `admin | member`
   - Layout with `<AppSidebar />` + `<Outlet />`

3. **`src/routes/_authenticated.client.tsx`**
   - Role gate: `client` (admins also allowed for support/debug)
   - Layout with `<AppSidebar />` + `<Outlet />`

4. **`src/routes/_authenticated.main.index.tsx`**
   - Redirect to `/talentportal/main` (existing admin dashboard page)

5. **`src/routes/_authenticated.staff.index.tsx`**
   - Redirect to `/talentportal/staff` (existing staff landing)

6. **`src/routes/_authenticated.client.index.tsx`**
   - Redirect to `/talentportal/clients` (existing client landing)

---

### Edits

7. **`src/routes/_authenticated.portal.tsx`**
   - Add role-based redirect in `beforeLoad`:
     - admin → `/main`
     - member → `/staff`
     - client → `/client`
   - Keep the existing layout for backward compatibility (old `/portal/*` bookmarks still work)

8. **`src/routes/login.tsx`**
   - Simplify `destinationForRoles` to return `/main`, `/staff`, `/client` instead of `/talentportal/*`
   - Remove the special-case `cameFromApply` guard that still points to old paths

---

### What stays untouched

- All `_authenticated.portal.*` page bodies (they keep working under both `/portal/*` and `/talentportal/*`)
- `AppSidebar.tsx`
- Server functions, DB, RLS

---

### Verification

- Admin logs in → lands on `/main` (redirects to `/talentportal/main` for now)
- Member logs in → lands on `/staff` (redirects to `/talentportal/staff` for now)
- Client logs in → lands on `/client` (redirects to `/talentportal/clients` for now)
- Old `/portal/*` and `/talentportal/*` bookmarks still work

---

**Files changed:** 6 new + 2 edited = 8 files total. No DB changes. No new dependencies.