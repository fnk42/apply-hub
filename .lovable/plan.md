# Auth hardening + Clients overview + click-cycle payment status

## Bundle A — Restore Google sign-in safely + reset password

**Allowed domains:** `goldenpipitrecruiting.com` (internal), `mpshahhospital.org` (client).

**Layered guardrails:**

1. **`allowed_emails` table** (admin-only RLS):
   ```
   email citext primary key
   role  app_role not null     -- 'admin' | 'member' | 'client'
   client_id uuid null         -- required when role='client'
   invited_by uuid, created_at timestamptz
   ```
   Seed `felix@goldenpipitrecruiting.com` → admin.

2. **Replace `handle_new_user()` trigger** — runs on every new `auth.users` row:
   - Reject if email domain ∉ allowed list → `RAISE EXCEPTION 'Access is invite-only'`.
   - Reject if email ∉ `allowed_emails` → same exception (no session ever issued).
   - Otherwise insert matching `user_roles` row. If role='client', set `clients.auth_user_id` for the linked client.

3. **Client-side post-OAuth guard** in `/login`: after Google returns, read `session.user.email`; if domain not allowed → `signOut()` + toast.

4. **Route guards:**
   - `/portal/*` — admin OR member OR client (existing). Clients sign in and land here; RLS scopes them to their own job ads and candidates.
   - `/portal/clients`, `/portal/admin`, `/portal/settings` — admin only (already enforced).
   - `/client/*` — admin only (admin preview tooling).

5. **Re-enable Google** via `supabase--configure_social_auth providers: ["google"]`; keep email/password fallback. Re-add Google button to `/login`.

6. **Password reset** — prompt for `ADMIN_RESET_PASSWORD` secret, run one-off `supabaseAdmin.auth.admin.updateUserById` for `felix@goldenpipitrecruiting.com`, then delete the secret.

7. **Team & access page** — Allowed-emails CRUD section. When role='client', a dropdown picks which client they belong to.

---

## Bundle B — Clients overview (admin-only)

Data model already supports "one client → many job ads → clients see only their candidates" via existing `job_ads.client_id` + RLS. **No category field** (per your instruction). **No schema change.**

### Admin overview at `/portal/clients`
Extend `listClients` (admin-only server fn) to return per-client derived metrics:
- **Live roles**: `SUM(roles_count)` over `job_ads` where `status='live'`.
- **Open ads / total ads** counts.
- **Expected revenue (KES)**: `SUM(payments.amount)` where status in (`pending`,`paid`).
- **Collected (KES)**: `SUM(payments.amount)` where status='paid'.
- **Candidates this month**.

Table gains columns: Live roles · Open ads · Expected (KES) · Collected (KES). Plus search by name. Row click → new `/portal/clients/$id` detail page (header, job ads table, payments table, pipeline summary, editable notes).

### Client-facing view (unchanged)
Sign in → `/portal` → sidebar lists only their live job ads (RLS) → click ad → manage their candidates (stage / fit / shortlist / notes / CV download per role permissions).

---

## Bundle C — Click-cycle payment status (Admin → Payments)

Mirror the Fit click-cycle pattern from the candidates table.

In `src/routes/_authenticated.portal.admin.tsx` (payments table):
- Replace the status dropdown with a `<PaymentStatusBadge>` button.
- **Cycle:** `pending` → `paid` → `void` → `pending`.
- On click: call `setPaymentStatus({ id, status: next })`, invalidate `["payments"]`, toast on failure. `stopPropagation` so it doesn't trigger row navigation.
- Visual: colored pill (`pending` muted/amber, `paid` emerald, `void` red), `cursor-pointer`, hover ring, `title="Click to cycle status"`.

Server fn: add `setPaymentStatus` in `src/lib/admin.functions.ts` (admin-gated, validates enum, sets `paid_at = now()` when moving to `paid`, clears it otherwise). Replaces/augments the existing `markPaymentPaid` + `voidPayment` pair (those can stay or be removed — `setPaymentStatus` supersedes them).

---

## Files touched

**Bundle A**
- Migration: create `allowed_emails` + RLS + replace `handle_new_user()`.
- Data insert: seed felix into `allowed_emails`.
- `supabase--configure_social_auth providers: ["google"]`.
- `src/routes/login.tsx` — Google button + post-OAuth domain check.
- `src/lib/team.functions.ts` (new) — list/add/remove allowed emails.
- `src/routes/_authenticated.portal.settings.tsx` — Allowed emails section.
- One-off password reset script + secret prompt/delete.

**Bundle B**
- `src/lib/candidates.functions.ts` — extend `listClients` with derived metrics; add `getClientDetail`.
- `src/routes/_authenticated.portal.clients.tsx` — new columns + search.
- `src/routes/_authenticated.portal.clients.$id.tsx` (new) — admin client detail page.

**Bundle C**
- `src/lib/admin.functions.ts` — add `setPaymentStatus` (admin-gated).
- `src/routes/_authenticated.portal.admin.tsx` — replace status dropdown with click-cycle pill.
- `src/components/portal/Badges.tsx` — add `PaymentStatusBadge` (mirrors `FitBadge` styling).

No changes to public apply flow, RLS on `applications`, or the client-facing portal layout.
