
## Goal

Restyle the recruiter portal to match Transformari's layout, add `years_of_experience` and `current_company` fields, surface resume + screening answers properly on the detail view, and switch pipeline status to one-click buttons (matching today's fit pattern).

## 1. Schema changes (migration)

Add two columns to `applications`:
- `years_of_experience` — integer, nullable (NULL = "Not applicable / Prefer not to say")
- `current_company` — text, nullable, max 160 chars (NULL/empty rendered as "—"; a separate `current_company_na` boolean isn't needed — we treat empty as N/A)

No RLS changes. No data backfill needed.

## 2. Public apply form (`src/routes/index.tsx`)

Add two new fields above the screening section:
- **Current company** — text input, optional, with a "Not currently employed / N/A" checkbox that clears + disables the input.
- **Years of professional experience** — number input (0–60), required.

Keep LinkedIn as free-form text (already done).

## 3. Recruiter portal — Transformari layout

Replace the current top-only layout with a persistent left sidebar shell.

### New layout route: `src/routes/_authenticated.portal.tsx`
Wraps all `/portal/*` routes with:

```text
┌────────────┬──────────────────────────────────────────┐
│ Pipit      │  Pipit Search Hub        [role] [avatar] │
│ Search Hub │──────────────────────────────────────────│
│            │                                          │
│ ▸ Candidat │   <Outlet />                             │
│   Add new  │                                          │
│   Activity │                                          │
│   Settings │                                          │
│            │                                          │
│ Felix N.   │                                          │
│ Recruiter  │                                          │
│ Sign out   │                                          │
└────────────┴──────────────────────────────────────────┘
```

- Sidebar: 240px, black background (Pipit black), yellow accent on active item, serif wordmark at top, user block + sign-out at bottom.
- Top header bar: thin, white, holds the "Pipit Search Hub · Recruiter" subtitle and right-side role badge + avatar + sign-out icon.
- Use the shadcn `Sidebar` primitive with `collapsible="icon"` so it collapses to icons on narrow screens.
- Nav items (initial set): Candidates, Add candidate, Activity log (read-only list of all `application_events`), Settings (placeholder).

### Candidates list (`_authenticated.portal.index.tsx`)
- Large serif page title "Candidates" + count chip ("12 total").
- Filters row: Stage (status), Fit, search.
- **Remove the Source column.**
- Name cell: candidate name as a **link to the LinkedIn URL** (opens in new tab, with external-link icon) when present, falling back to plain text. Below the name in smaller muted text: `{current_company}` (or `Independent` if N/A). Row click still navigates to detail.
- New `YOE` column (numeric, right-aligned, "—" if null).
- Stage cell: inline dropdown badge (click to change status without opening the row).

### Candidate detail (`_authenticated.portal.$id.tsx`)
- Header: name as LinkedIn hyperlink (external-link icon), company + YOE underneath in smaller text.
- **Pipeline status → 4-button grid** matching the existing Fit grid (Sourced / Scheduled / Rejected / Declined). One click sets the value.
- Ensure **resume download** + **screening answers** sections always render when data is present. Investigate current behavior — for a public-form submission they should appear; the manual-add path won't have them and should show a subtle "No resume uploaded" / "No screening answers" placeholder instead of hiding the section entirely (this is why the user "doesn't see" them when poking around with manually-added candidates).

### Add candidate (`_authenticated.portal.new.tsx`)
- Add the same `current_company` (+ N/A checkbox) and `years_of_experience` fields, both optional here.

## 4. Server function updates (`src/lib/candidates.functions.ts`)

- `listCandidates` — select the two new columns.
- `getCandidate` — same.
- `createCandidate` (manual add) — accept and persist the two new fields.
- `updateCandidate` — already allows arbitrary patch; add the two field names to the allowlist.
- No change to `getResumeSignedUrl`.

## 5. Theme (light touch only, not the full Pipit black/yellow pass)

This plan keeps tokens as-is — full Pipit black/yellow theming is still parked for "Prompt 3". The sidebar uses black bg + yellow active state via direct utility classes inside the sidebar component only, so the rest of the portal continues to read clean while we validate the layout.

---

## Files touched

- `supabase/migrations/<new>.sql` — add 2 columns
- `src/routes/index.tsx` — 2 new fields on apply form
- `src/routes/_authenticated.portal.tsx` — replace with sidebar shell
- `src/routes/_authenticated.portal.index.tsx` — drop source col, add YOE col, name→LinkedIn, company subline
- `src/routes/_authenticated.portal.$id.tsx` — header restyle, status button grid, always-render screening/resume sections
- `src/routes/_authenticated.portal.new.tsx` — 2 new fields
- `src/lib/candidates.functions.ts` — pass-through new fields
- `src/components/portal/AppSidebar.tsx` (new) — Transformari-style nav

## Not in scope (defer)

- Full Pipit black/yellow color token pass across the public site & forms
- Dashboard overview page with stat cards / pipeline funnel (Transformari has it; we can add later)
- Shortlist / Import / PE Firms / Weekly Report pages
- `CLAUDE.md` + `docs/design-system.md` handoff docs
