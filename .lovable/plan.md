# Phase 5 + Phase 6 Plan

Shipping the remaining two phases in one migration + one code pass so we can fire them together.

---

## Phase 5 — Admin area (billing & notifications)

### Database
- New table `payments`: `job_ad_id`, `client_id`, `amount_cents`, `currency` (default `usd`), `status` (`pending` / `paid` / `void`), `triggered_by` (`auto_10_candidates` / `manual`), `notes`, `paid_at`. Admin-only RLS; clients can read their own paid rows.
- New table `notifications`: `user_id`, `type`, `title`, `body`, `link`, `read_at`. Users read/update their own; system inserts.
- Trigger on `applications`: when the 10th application is inserted for a `job_ad_id` whose `is_billable = true` and `billing_triggered_at IS NULL`, insert a `payments` row (`pending`, `auto_10_candidates`) and stamp `billing_triggered_at = now()`. One-shot per job.
- Trigger on `job_ads` insert: if `is_billable`, default `posting_fee_cents` from `app_settings.default_posting_fee_cents` (admin-editable).

### UI
- `/portal/admin` (admin-only, sidebar link gated on `isAdmin`):
  - **Billing** tab — table of `payments` with filters (status, client, date), mark-paid / void actions.
  - **Settings** tab — edit `default_posting_fee_cents`, app name (moves out of placeholder).
- Strip fee/billing fields from the job page for non-admins (currently `posting_fee_cents` / `is_billable` show in `_authenticated.portal.jobs.$slug.tsx` — gate behind `roles.includes("admin")`).
- Notification bell in header (`portal` layout): unread count + dropdown list, click marks read and follows `link`.

### Server functions (`src/lib/admin.functions.ts`)
- `listPayments`, `markPaymentPaid`, `voidPayment`, `getAppSettings`, `updateAppSettings` — all `requireSupabaseAuth` + admin role check.
- `listMyNotifications`, `markNotificationRead`.

---

## Phase 6 — Roles cleanup & Settings

### Database
- Migrate any existing `recruiter` rows in `user_roles` → `member`.
- Update `handle_new_user()` trigger to insert `member` (not `recruiter`) for new signups.
- Update `is_recruiter_or_admin()` → rename to `is_internal()`, check `admin` OR `member`. Keep old name as alias for one release to avoid breaking existing policies; update all RLS policies referencing `recruiter` to reference `member`.
- Drop `recruiter` from `app_role` enum **last** (after policies updated). Postgres requires recreating the enum — done via `ALTER TYPE ... RENAME` + new type swap in the same migration.

### UI
- `/portal/settings` (replace placeholder):
  - **Workspace** — app name (admin-only edit).
  - **Users** — list users with their roles; admin can invite by email (reuses `inviteClient` pattern but for internal `member`/`admin`) and change role.
  - All authenticated internal users can view their own profile/email + sign out.
- Sidebar: relabel "Search Portal" subtitle if needed; remove any leftover `recruiter` references in `AppSidebar.tsx` and `_authenticated.portal.tsx` guards (replace with `member`).
- Legacy route cleanup: audit `src/routes/` for orphaned files (`_authenticated.portal.candidates.tsx`, `_authenticated.portal.shortlist.tsx`, `_authenticated.portal.$id.tsx` — confirm whether still linked; remove if dead).

### Server functions
- `inviteInternalUser({ email, role })` — admin only, sends Supabase magic-link invite, inserts `user_roles` row on first sign-in via `handle_new_user` + a post-confirm hook (or upsert in the invite call).
- `listInternalUsers`, `updateUserRole`, `removeUser` — admin only.

---

## Order of operations
1. **Migration** (single file): payments + notifications tables & RLS, billing trigger, app_settings defaults, recruiter→member migration, enum swap, policy updates, handle_new_user update.
2. **Code**: admin functions file, admin route + tabs, notification bell, settings page rewrite, sidebar/guard updates, gate billing fields on job page, dead-route cleanup.

## Out of scope (parked)
- Email notifications on new application (parking-lot item).
- Fix "Add candidate" internal button (parking-lot item).
- Portal load speed-up (parking-lot item).

Ready to switch to build mode and fire the migration + code together?
