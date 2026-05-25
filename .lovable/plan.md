# Job ad detail + auth cleanup + roles & permissions

Five changes. No DB schema migrations (one data-only role update). No changes to the public apply flow.

---

## 1. Click-to-cycle Fit (no detail page open)

In `src/routes/_authenticated.portal.jobs.$slug.tsx`:
- Wrap the Fit cell in a `<button>` with `onClick` + `stopPropagation` so the row no longer navigates from that cell.
- Cycle: `unrated` → `strong` → `medium` → `weak` → `unrated`.
- On click: call `updateCandidate({ data: { id, patch: { fit: next } } })`, then invalidate `["candidates"]`. Toast on failure.
- Visual: keep `FitBadge` colors; add `cursor-pointer`, hover ring, `title="Click to cycle fit"`.

Row navigation still works from Name / Date / YOE. Resume / Stage / Shortlist cells already stop propagation.

---

## 2. Add candidate → always lands in "Sourced"

a) **"Not working"** — likely RLS: account currently has no `member`/`admin` role. Resolved by the role grant in §4 below.

b) **Force Sourced stage** — in `createCandidate` (`src/lib/candidates.functions.ts`): look up the stage row for this `job_ad_id` where `legacy_status = 'sourced'`, fall back to position-1. Set `stage_id` to that row and `pipeline_status = 'sourced'`.

---

## 3. Replace Inbound / Sourced tabs with All / Strong fit / Shortlist

In `src/routes/_authenticated.portal.jobs.$slug.tsx`:
- Tabs: **All candidates** (no filter), **Strong fit** (`fit === "strong"`), **Shortlist** (`shortlisted === true`). Pill counts update accordingly.
- Remove the standalone **Fit** and **Shortlist** dropdowns (now tabs).
- Keep: search + Stage dropdown.
- State `tab: "all" | "strong" | "shortlist"`. Empty-state copy adjusts per tab.

---

## 4. Remove Google sign-in (email/password only)

In `src/routes/login.tsx`:
- Delete the "Continue with Google" button, `handleGoogle`, the `lovable` import, the "or email" divider, and the `POST_LOGIN_KEY` sessionStorage dance (only used for the OAuth roundtrip).
- Keep email/password and the "Access is invite-only" helper text.

Disable Google at the provider level: call `configure_social_auth` with `disable_providers: ["google"]` so deep links / stale tabs can't initiate OAuth.

Allowlist enforcement: already handled — `handle_new_user()` grants nothing, `/portal` guard + RLS block any account without a role. Admins grant access via Settings → Team members.

---

## 5. Role management UI + permission model

### 5a. UI — already exists, light polish only

`src/routes/_authenticated.portal.settings.tsx` already lists internal users (email, role, last sign-in), supports invite, change role (admin ↔ member), and remove. No new routes needed.

Tweaks:
- Add a **Status** column: "Active" (has logged in) vs "Pending" (never signed in — `last_sign_in_at IS NULL`). Display-only badge derived from existing data; no schema change.
- Add a one-line legend under the table explaining what each role can do (mirrors §5c).
- Rename page heading from "Settings" to "Team & access" so it's discoverable.
- Sidebar entry already exists; verify the label reads "Team".

Backed by existing `listInternalUsers`, `inviteInternalUser`, `setUserRole`, `removeInternalUser` — no new server fns.

### 5b. Grant your account a role now

Data-only insert (no schema change):
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'felix@goldenpipitrecruiting.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO user_roles (user_id, role)
SELECT id, 'member' FROM auth.users WHERE email = 'felix@goldenpipitrecruiting.com'
ON CONFLICT (user_id, role) DO NOTHING;
```
This unblocks Add candidate (§2a) and all member actions immediately.

### 5c. Permission model — enforced in server fns + RLS

| Action | Member | Admin |
|---|---|---|
| View candidates & job ads | ✅ | ✅ |
| Change pipeline stage / status | ✅ | ✅ |
| Change fit (click-to-cycle) | ✅ | ✅ |
| Toggle shortlist | ✅ | ✅ |
| Edit recruiter notes | ✅ | ✅ |
| Download an individual CV | ✅ | ✅ |
| Add candidate manually | ❌ | ✅ |
| Delete candidate | ❌ | ✅ |
| Bulk export / download all data | ❌ | ✅ |
| Create / close / edit job ads | ❌ | ✅ |
| Manage clients | ❌ | ✅ |
| Manage team (invite / role / remove) | ❌ | ✅ |
| Manage payments & app settings | ❌ | ✅ |

Enforcement points:
- **Server fns** — `createCandidate`, `createJobAd`, `closeJobAd`, `reopenJobAd`, `updateJobAd`, anything client-mutating, and any future "export all" fn get an `assertAdmin` gate (same helper already used in `admin.functions.ts`). `deleteCandidate` and team-management fns already gate on admin.
- **`updateCandidate`** (stage/fit/shortlist/notes) stays open to both roles — RLS `recruiters update applications` already allows admin+member.
- **UI** — buttons hidden for members: "Add candidate", "Create job ad", "Close/Reopen", "Delete", any future "Export all". Members still see the rest. Uses the existing `isAdmin` flag pattern (`rolesData.roles.includes("admin")`).
- **Single-CV download** — uses the existing per-row resume link, available to both roles. No "download all CVs" button is exposed to members.

No RLS migration needed: current policies already split admin-only writes (job_ads, clients, payments, app_settings, user_roles) from recruiter-or-admin writes (applications). Server-fn gates cover the few cases not naturally captured by RLS (e.g. `createCandidate` blocking members).

---

## Files touched

- `src/routes/_authenticated.portal.jobs.$slug.tsx` — §1, §3, hide admin-only buttons for members.
- `src/lib/candidates.functions.ts` — §2b, admin gate on `createCandidate`.
- `src/lib/jobs.functions.ts` — admin gate on create/close/reopen/update (verify; add where missing).
- `src/routes/login.tsx` — §4.
- `src/routes/_authenticated.portal.settings.tsx` — §5a polish (Status column, legend, heading).
- One social-auth provider call (disable `google`).
- One data-only role insert for your account.

No changes to `/apply/$slug`, public submission, RLS schema, storage policies, or the role/permission database structure.

