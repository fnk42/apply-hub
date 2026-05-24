# Phased Rollout — Project Dashboard v2 (with UAT)

Ship in **vertical slices**. Each phase = one migration + one feature surface + **one UAT pass you sign off before we move on**.

UAT format per phase:
- I post a numbered checklist in chat after deploy.
- You run through it in the live preview (5–10 min).
- Reply "pass" or list failing item numbers. I fix only those, then we proceed.
- Anything not on the checklist is out of scope for that phase (logged for later).

---

## Phase 1 — Foundations: roles, clients, job_ads, seed (no UI change)

**Build**
- Migration: create `clients`, `job_ads`, `app_settings`; extend `app_role` to add `member`.
- Add `applications.job_ad_id` nullable; seed client "Golden Pipit Group" + ad "Business Manager" (live, slug = current); backfill, then `NOT NULL`.
- Seed `app_settings.app_name = "Project Dashboard"`. Admin-only RLS on `clients`; read-only on `job_ads` for everyone else.

**UAT checklist**
1. `/portal/candidates` still loads and shows existing candidates.
2. `/portal/shortlist` still works.
3. Apply form at `/` still submits successfully.
4. Dashboard counters unchanged.
5. No console errors on any of the above.

---

## Phase 2 — Job-ad sidebar + ad detail page

**Build**
- Sidebar: LIVE / PENDING / CLOSED groups + Activity Log + Settings. Dashboard removed. Header shows `app_name`.
- New `/portal/jobs` list and `/portal/jobs/$slug` detail (header + reused candidate table filtered by `job_ad_id`).
- `/portal/candidates` and `/portal/shortlist` redirect to seed ad for now.

**UAT checklist**
1. Sidebar shows "Business Manager" under LIVE with live count.
2. Clicking it opens detail with title, status, roles, start date, LinkedIn link, View JD.
3. Candidate table inside ad matches the old `/portal/candidates` list.
4. Inbound/Sourced tabs and shortlist star still work.
5. Old `/portal/candidates` URL redirects to the new ad detail.

---

## Phase 3 — Per-ad pipeline stages + Add candidate moves

**Build**
- Migration: `job_ad_stages` + default-stage trigger; backfill stages for seed ad; add `applications.stage_id` nullable, backfill from `pipeline_status` (keep both this phase).
- `/portal/jobs/$slug/stages` (admin): add/rename/reorder/delete (block delete if used).
- Move add-candidate to `/portal/jobs/$slug/add-candidate`; delete `/portal/new`.

**UAT checklist**
1. As admin, reorder stages and confirm new order on the ad detail dropdowns.
2. Rename a stage; existing candidates keep correct mapping.
3. Try to delete a stage with candidates → blocked with clear message.
4. Add a new candidate from the ad detail page; appears in first non-terminal stage.
5. Change a candidate's stage via dropdown; persists after refresh.

---

## Phase 4 — Public apply form moves to `/apply/$slug`

**Build**
- `/apply/$slug` form; `submitApplication` validates slug + `status = 'live'`.
- `/` becomes invitation-only landing (no public ad index).

**UAT checklist**
1. `/apply/business-manager` shows the form and submits successfully.
2. Submitted candidate appears under Business Manager's candidate table.
3. `/apply/does-not-exist` shows a not-found state.
4. Set seed ad to `closed` temporarily → form refuses submission. Revert.
5. `/` no longer shows the apply form.

---

## Phase 5 — Admin area (you only)

**Build**
- Migration: `payments`, `notifications`, billing trigger (10-candidate rule).
- `/portal/admin/{index,authorizations,clients,clients/$id,jobs,payments}`.
- Admin: create client, create ad (`/portal/jobs/new`), set posting fee, authorize, log payment.
- Strip fee/billing fields from `job_ads` for non-admins.

**UAT checklist**
1. As admin, `/portal/admin` shows overview metrics + chart.
2. Create a test client + draft ad → appears in Authorizations queue → Authorize moves it to LIVE.
3. Submit 10 test applications → `ad_billing_ready` notification appears; ad shows in Payments "Ready to invoice".
4. Log a payment; revenue MTD updates.
5. Sign in as a non-admin test user → `/portal/admin/*` returns 403; fees not visible anywhere.

---

## Phase 6 — Unified member role + Settings + client portal cleanup

**Build**
- Migrate remaining `recruiter` → `member`; drop `recruiter` from enum.
- `/portal/settings`: app name edit, user invites (magic link), role assignment, deactivate. Members see profile only.
- `/portal/jobs/$slug/client-access` (admin): magic-link invite binds `clients.auth_user_id`. Client members' RLS scopes `job_ads` and `applications` to their `client_id`.
- Delete legacy `/portal/candidates` + `/portal/shortlist` routes; drop `applications.pipeline_status`.

**UAT checklist**
1. Admin renames app in Settings → sidebar header updates after refresh.
2. Invite a test client contact via magic link; on first login they land in `/portal`.
3. That client user sees only Business Manager and only Golden Pipit candidates — no other clients, no fees, no admin link.
4. They can drag candidates between stages but cannot edit stage definitions.
5. Recruiter test user sees all ads/candidates but no admin area, no fees, no payments.
6. No dead links anywhere (old `/portal/candidates` etc.).

---

## Cross-phase QA (run at end of every phase)

- Console clean on every visited route.
- `supabase--linter` shows no new errors.
- Auth still works for admin + member test users.
- Mobile width (375px) doesn't blow up the sidebar or ad detail.

## Credit-saving rules

- Reuse existing `StatCard`, `PipelineFunnel`, `RecentActivity`, candidate table, badges — no restyling until Phase 6.
- One migration per phase, batched.
- No speculative components; build only what each UAT checklist needs.
- If a UAT item fails, fix only that item — no scope creep mid-phase.
- Defer (logged, not built): email delivery, Stripe, member-initiated extra-ad requests, post-auth editing of `linkedin_job_url`.
