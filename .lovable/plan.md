## Goal

Adopt Transformari layout: cream sidebar shell, new **Overview dashboard**, candidates table with company/title sub-line + **Inbound vs Sourced** tabs + shortlist toggle, and an **Activity log** page. Fix the current SSR error along the way.

## 0. Fix the SSR error first

Portal currently throws `SSR rendering failed`. Likely culprits in the new sidebar layout: top-level `localStorage`/`window` access, or Tailwind 4 `w-[--sidebar-width]` not resolving. Diagnose and patch before adding more surface.

## 1. Sidebar restyle (cream, Transformari-style)

Update `src/components/portal/AppSidebar.tsx` + sidebar tokens in `src/styles.css`:
- Cream background, hairline right border
- Serif `{company.name}` wordmark + muted "Search Portal" subtitle
- Nav items with icons; subtle dark-green pill on active, sage tint on hover
- Footer: user email + sign-out

Nav (final set, slimmed down):
- Dashboard → `/portal`
- Candidates → `/portal/candidates`
- Shortlist → `/portal/shortlist`
- Activity Log → `/portal/activity`
- Settings → `/portal/settings` (stub for now)

## 2. Top header bar

`_authenticated.portal.tsx`: white, `SidebarTrigger` left, `{company.name} · {company.tagline}` center, role badge + avatar initial + sign-out icon right.

## 3. New Dashboard page (`/portal`)

Rename current candidates route → `_authenticated.portal.candidates.tsx`. New `_authenticated.portal.index.tsx` = Overview.

Server fn `getDashboardStats` in `src/lib/candidates.functions.ts`:
- Counts per pipeline_status this week vs last week
- Split by source: inbound (`public_form`) vs sourced (`manual`)
- Recent 10 `application_events` with candidate name

Components (new in `src/components/portal/`):
- `StatCard` — left colored border, uppercase label, big serif number, WoW delta
- `PipelineFunnel` — stage label + count + % + horizontal bar
- `RecentActivity` — avatar + actor + verb + candidate link + timestamp

Layout: 4–6 stat cards in a 3-col grid (Inbound this week, Sourced this week, Scheduled, Rejected, Declined, Total Active), then funnel (2/3) + activity feed (1/3).

Cards we can't populate from current schema (Reached Out / Screened separately) are omitted — not faked. Note in code that adding stages requires extending the status enum (deferred).

## 4. Candidates page (`/portal/candidates`) — Inbound vs Sourced

We already store `source` on `applications` (`public_form` for the apply form, `manual` for recruiter-added). Use it to split the list:

- **Tabs at the top: "Inbound applications" (default) | "Sourced"** — shadcn `Tabs`, count chip on each
- The candidate model stays single; only the filter changes
- `listCandidates` gains an optional `source` arg (`inbound` | `sourced` | undefined)
- Manual-add page already sets `source: "manual"` ✓

Table columns (final):
- Checkbox
- **Name** — name as LinkedIn link (external icon), company in muted text underneath, plus title line if/when we have it (omit if null)
- **Date sourced** (= `created_at`)
- **YOE**
- **Stage** (inline dropdown badge to change status)
- **Fit** (badge)
- **Shortlist** — star icon toggle (filled gold = on shortlist, outline = off)
- (no Location, no Source, no Screen-out reason, no Visibility)

Filters row (pill style): Stage, Fit, Shortlist (All / On shortlist / Off), search by name/email.

## 5. Shortlist page (`/portal/shortlist`)

Same table as Candidates but pre-filtered to `shortlisted = true`. Title "Your shortlist", subtitle "Candidates flagged for client review."

## 6. Activity log (`/portal/activity`)

New route. Filters: action type (All / fit_changed / status_changed / created / note_updated / manual_added), performer (distinct `actor_email`), date range. Server fn `listActivity` joins `application_events` with applicant name. Grouped by day with serif day heading; each row = avatar + "Felix Njenga updated fit on [Candidate]" + timestamp.

## 7. Settings stub

`_authenticated.portal.settings.tsx` — placeholder page so sidebar nav doesn't 404. Real settings later.

## Schema additions (one migration)

- `applications.shortlisted` boolean default false
- `applications.current_title` text nullable (optional sub-line under name when present; not added to public form yet to keep that form short)

That's it. No location, no screen-out-reason, no visibility column.

## Public form (`/`)

No new fields this round. Company + YOE already added in the previous build.

## Server function updates (`src/lib/candidates.functions.ts`)

- `listCandidates`: add `source?: 'inbound' | 'sourced'` and `shortlisted?: boolean` to input; map `inbound → source='public_form'`, `sourced → source='manual'`; select `shortlisted` and `current_title`
- `updateCandidate`: allow `shortlisted` boolean in patch allowlist
- `getDashboardStats`: NEW
- `listActivity`: NEW

## Files touched

- `src/styles.css` — sidebar tokens to cream
- `src/components/portal/AppSidebar.tsx` — restyle + trimmed nav
- `src/routes/_authenticated.portal.tsx` — header polish, SSR fix
- `src/routes/_authenticated.portal.index.tsx` — REPLACED with dashboard
- `src/routes/_authenticated.portal.candidates.tsx` — NEW (moved list + Inbound/Sourced tabs + shortlist toggle)
- `src/routes/_authenticated.portal.shortlist.tsx` — NEW
- `src/routes/_authenticated.portal.activity.tsx` — NEW
- `src/routes/_authenticated.portal.settings.tsx` — NEW (stub)
- `src/routes/_authenticated.portal.$id.tsx` — add shortlist toggle button
- `src/lib/candidates.functions.ts` — `getDashboardStats`, `listActivity`, source/shortlist passthroughs
- `src/components/portal/{StatCard,PipelineFunnel,RecentActivity}.tsx` — NEW
- Migration: `shortlisted` + `current_title` columns

## Not in scope (deferred)

- New pipeline stages (Reached Out, Screened) — needs status enum extension
- Editable inline screen-out reason
- Full Pipit black/yellow rebrand
- Real Settings page (authorized users, search start date)
