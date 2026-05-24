
# Admin Job Ads tab + KES currency + fixes + audit

## 1. Admin → Job Ads tab (new)

New tab in `/portal/admin` alongside Billing and Settings: **Job Ads**.

Table columns: Client · Title · Status · Roles · Fee (KES) · Billable · Billing status · Created · Actions (Open).

- Lists every `job_ads` row (admin-only, via `supabaseAdmin`).
- Business Manager will appear here as `pending_authorization` immediately — no need to wait for the 10-candidate billing trigger.
- Status filter chips (All / Pending / Live / Closed).
- Row click → `/portal/jobs/$slug`.

New server fn `listAllJobAds` in `src/lib/admin.functions.ts`.

## 2. Currency: KES, no cents

Switch storage and display from USD cents to whole KES.

**Schema migration:**
- `job_ads.posting_fee_cents` → rename to `posting_fee` (integer, whole KES). Existing values divided by 100 during migration (so $35,000 stored as 3,500,000 cents → 35,000 KES).
- `payments.amount_cents` → rename to `amount` (integer, whole KES). Same /100 conversion.
- `payments.currency` default → `'kes'`; backfill existing rows to `'kes'`.
- `app_settings` key `default_posting_fee_cents` → `default_posting_fee` (whole KES). Default value 35000.
- Update `maybe_trigger_billing()` and `set_default_posting_fee()` triggers to use new column names and new default (35000).

**Code updates** (all `_cents` references → whole KES, no `/100` math):
- `src/lib/jobs.functions.ts` (`createJobAd` input + insert)
- `src/lib/admin.functions.ts` (`listPayments`, `getAppSettings`, `updateAppSettings`)
- `src/lib/candidates.functions.ts` (`getJobAdBySlug` billing fields)
- `src/routes/_authenticated.portal.admin.tsx` (Billing table amount, Settings fee input — label "Default posting fee (KES)")
- `src/routes/_authenticated.portal.jobs.new.tsx` (Posting fee input — label "KES")
- `src/routes/_authenticated.portal.jobs.$slug.tsx` (JD admin strip)
- Formatting: `KES 35,000` (no decimals, thousands separator).

## 3. Fix "Add candidate" (parking lot #3)

Audit `/portal/jobs/$slug/add-candidate` and the entry button on the job page:
- Verify the route exists in `routeTree.gen.ts` and the button links correctly.
- Confirm `addCandidateManual` server fn (or whatever it's called) is wired, validates input, inserts into `applications` with `source='manual'`, and respects RLS.
- Fix resume upload to `resumes` bucket if broken.
- Toast + redirect to job page on success; surface real error message on failure.

## 4. Portal load speed (parking lot #5)

Measured wins, no architectural rewrite:
- **Parallelize** sequential awaits in `getPortalShell` and `getJobAdBySlug` with `Promise.all`.
- **Stage prefetch:** in `/portal/jobs` index loader, `ensureQueryData` for the portal shell so sidebar doesn't refetch on every nav.
- **Select narrow columns** instead of `select('*')` on hot queries (applications list, job_ads list).
- **Stable React Query keys** + `staleTime: 30_000` on shell + job lists so sidebar/job list don't re-fetch on every route change.
- **Lazy-mount** `NotificationBell` polling to one interval instead of per-mount.

Skip: code-splitting / route chunking (already on by default in TanStack Start).

## 5. Resume visible on candidate row (front DB view)

On `/portal/jobs/$slug` candidate list (and `/portal/candidates` if it shows the same table):
- Add a **Resume** column with a "View" link → opens `resume_url` (signed URL for the `resumes` bucket) in a new tab.
- "—" when no resume on file.
- Include `resume_url` in the candidate list query projection if not already there.

## 6. End-to-end audit (after the above lands)

Walk every route signed in as admin, member, and client. For each, verify:
- Loads without errors (console + network 4xx/5xx clean).
- RLS behaves correctly (clients see only their own jobs/candidates/paid payments).
- Add-ad → appears in sidebar Pending + Admin → Job Ads tab.
- Add-candidate → appears in pipeline + activity log; 10th candidate triggers a `pending` payment in KES.
- Close ad → status flips, `/apply/$slug` shows "no longer accepting" notice; reopen works.
- JD panel renders for admin (with fee + billing strip) and client (without).
- Admin → Billing: mark paid / void work; amounts display as KES.
- Settings: change app name + default fee, verify it propagates to new ads.
- Resume link opens correctly for uploaded and manually-added candidates.
- Lighthouse-style spot check: TTI on `/portal` and `/portal/jobs/$slug` after speed changes.

Findings written up as a short report at the end of the build with any follow-ups flagged.

## Out of scope (deferred)

- Email notifications (#4) — parked per your call.
- Full edit of all ad fields beyond create + close/reopen.
