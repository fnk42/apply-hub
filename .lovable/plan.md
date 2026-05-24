# Phase 2 addendum — Dashboard removal + `/portal` redirect

Locked in your choice (b). No other Phase 2 scope changes.

## What changes in Phase 2

1. **Sidebar**
   - Remove the "Dashboard" item.
   - New groups: LIVE / PENDING / CLOSED, plus Activity Log and Settings.
   - Header shows `app_settings.app_name` ("Project Dashboard").

2. **`/portal` route behavior**
   - Loader queries `job_ads` for `status = 'live'`.
   - If exactly **1** live ad → `redirect` to `/portal/jobs/$slug` (today: `/portal/jobs/business-manager`).
   - If **2+** live ads → `redirect` to `/portal/jobs` (the list).
   - If **0** live ads → `redirect` to `/portal/jobs` (which renders an empty state).
   - The old dashboard page component (`StatCard` + `PipelineFunnel` + `RecentActivity` grid) is deleted from this route.

3. **Components kept, not deleted**
   - `StatCard`, `PipelineFunnel`, `RecentActivity` stay in `src/components/portal/`.
   - Reused inside `/portal/jobs/$slug` (per-ad funnel + per-ad recent activity in the detail header area).
   - Reused later in Phase 5 admin overview (`/portal/admin`).

## UAT additions for Phase 2

Append to the existing Phase 2 checklist:
6. Visiting `/portal` redirects to `/portal/jobs/business-manager` (since only one live ad exists).
7. Sidebar no longer shows a "Dashboard" entry.
8. Sidebar header reads "Project Dashboard".

## Not in this phase

- No admin overview page yet (Phase 5).
- No edit of `app_name` from the UI yet (Phase 6 Settings).
- No change to `/portal/candidates` or `/portal/shortlist` beyond the redirect-to-seed-ad already planned.

Ready to switch to build mode and execute Phase 2 when you approve.