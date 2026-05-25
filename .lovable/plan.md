# Working list — 8 prompts

Ticking off what's already shipped, leaving the rest as the active queue.

## Done

- [x] **1. Remove email domain whitelist.** Deleted the goldenpipit/mpshah hard-checks in `inviteInternalUser`, `addAllowedEmail`, and `inviteClient`. Any valid email can now be invited; the `allowed_emails` table remains the real gate.
- [x] **2. Recover gracefully when an invitee already exists.** Both invite flows now detect `already registered` and send a password-reset link instead of silently failing.
- [x] **3. Fix invite email not landing.** Reverted to the platform default email sender so auth emails deliver reliably.
- [x] **4. Roll back the fit-status logic.** Restored the simple cycle: unrated → weak → medium → strong → unrated, so clicks always advance and never get stuck on "weak".
- [x] **5. Keep the blue hover transition on candidate names.** Underline + blue color transition retained for names with LinkedIn URLs.
- [x] **6. Make clients editable.** Added `updateClient` server fn and an "Edit client" dialog on the client detail page (name, contact, notes, ad allowance).
- [x] **7. Make job ads editable.** Added `updateJobAd` server fn and an "Edit ad" dialog on the job page (title, role count, start date, JD text/URLs, billing status/fees).

## In flight — prompt 7 of 8 (the current one)

- [ ] **Prev/next navigation on the candidate detail page.** Left/right chevrons in the header (plus `←` / `→` keyboard shortcuts) that move through the originating job ad's candidate list without leaving the detail view. Implemented by passing a `from=<job_ad_id>` search param when opening a candidate and computing prev/next from that ad's cached candidates query. Arrows hide on deep links with no `from`.
- [ ] **Color-coded pipeline stage chips** everywhere stages render (job table, candidate header, stages page, funnel). Mapping by `legacy_status`:
  - Sourced → slate
  - Scheduled for Interview → **blue**
  - Hired → **green**
  - Rejected at Screening → red
  - Candidate Declined → amber
  - Custom user-added stages → neutral fallback
  Tokens added to `src/styles.css`.
- [ ] **Add "Hired" as a default stage.** Migration updates `seed_default_job_ad_stages()` to insert `('Hired', 5, 'hired', true)` and backfills a Hired row for every existing job ad missing one. New default order: Sourced → Scheduled for Interview → Hired → Rejected at Screening → Candidate Declined.

## Pending

- [ ] **8. Your next prompt** — send it and I'll bundle it with the in-flight work above into a single implementation pass.

## Files I'll touch when you greenlight

`src/routes/_authenticated.staff.$id.tsx`, `src/routes/_authenticated.staff.jobs.$slug.tsx`, `src/components/portal/Badges.tsx`, `src/components/portal/PipelineFunnel.tsx`, `src/styles.css`, plus one new migration for the Hired stage.