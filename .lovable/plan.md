# Add Ad + JD on job page + Close ad

Scoped to items #1 and #2 from the parking lot, plus the ability to close an existing ad. No schema changes — existing `job_ads` columns (incl. `status`, `closed_at`) cover everything.

## 1. Add Ad (admin only)

**Entry points (admin-only, gated by `has_role('admin')`):**
- "New job ad" button on `/portal/jobs` list page header
- Tile/link in `/portal/admin`

**New route:** `/portal/jobs/new` — admin-guarded; non-admins redirected to `/portal/jobs`.

**Form fields:**
- Client (dropdown from `clients`)
- Title + Slug (auto-derived from title, editable, uniqueness validated)
- JD text (textarea) + JD URL (optional) + LinkedIn job URL (optional)
- Roles count (default 1 — e.g. Business Manager = 3)
- Start date (optional)
- Is billable (toggle, default on)
- Posting fee in dollars (default from `app_settings.default_posting_fee_cents`, editable; stored as cents — e.g. $35,000 → 3,500,000)
- Status defaults to `pending_authorization`

**Server fn:** `createJobAd` in `src/lib/jobs.functions.ts`, admin-only via `requireSupabaseAuth` + admin check. Inserts into `job_ads` with `created_by = userId`. Existing `seed_default_job_ad_stages` trigger auto-seeds the pipeline stages.

On success: redirect to `/portal/jobs/{slug}`.

## 2. JD visible on job detail page

On `/portal/jobs/$slug`, add a collapsible JD panel above the pipeline showing:
- Title, client name, roles_count badge, status badge
- JD text (preserved-whitespace block, collapsed to ~6 lines with "Show more")
- External links row: JD URL, LinkedIn job URL (when set)
- Admin-only inline strip: posting fee, billing status (pending / triggered_at / paid)

Pipeline stays directly below — JD is visible without drilling into a candidate.

## 3. Close ad (admin only)

Admin-only "Close ad" button in the JD panel header on `/portal/jobs/$slug`.

- Confirmation modal: "Close this ad? Candidates remain visible but no new applications will be accepted."
- Server fn `closeJobAd({ id })`: sets `status = 'closed'` and `closed_at = now()`.
- Reopen action also available for already-closed ads (`status = 'open'`, `closed_at = null`).
- When `status = 'closed'`, the public application form on the candidate-facing job page shows a "This role is no longer accepting applications" notice instead of the form.

## Out of scope (deferred)

- Full edit of all ad fields (only close/reopen for now)
- Add Candidate fix (#3), portal load speedup (#5), email notifications (#4) — next pass
