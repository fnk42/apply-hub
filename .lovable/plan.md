## Prompt 6 — `/main` Admin Dashboard

**Goal:** Replace the placeholder `/main` page with a real admin overview. One server round trip, mixing big numbers with charts and a recent-activity feed.

---

### Widgets (final list)

**Top row — KPI tiles (StatCard):**
1. **Open jobs** — count of `job_ads` where `status = 'live'` and `archived_at IS NULL`
2. **Live applications** — count of `applications` joined to live ads
3. **Candidates added this week** — `applications` with `created_at >= date_trunc('week', now())`
4. **Shortlisted** — `applications` where `shortlisted = true` AND parent ad is live

**Second row — Revenue tiles (StatCard, currency formatted in KES):**
5. **Revenue this month** — `sum(payments.amount)` where `status = 'paid'` AND `paid_at >= date_trunc('month', now())`
6. **Revenue this quarter** — same, `date_trunc('quarter', now())`
7. **Revenue this year** — same, `date_trunc('year', now())`

**Charts row (2-col grid on desktop, stacked on mobile):**
8. **Pipeline funnel** — reuse existing `PipelineFunnel` component. Aggregate `applications.pipeline_status` (or resolved `stage_id`) across all live ads.
9. **Top clients by open roles** — horizontal bar chart (recharts, already in deps). Top 5 clients ranked by sum of `roles_count` from their live `job_ads`. Each row links to `/main/clients/{id}`.

**Bottom row (2-col):**
10. **Recent activity** — reuse existing `RecentActivity` component, last 10 events from `application_events`.
11. **Revenue trend** — small recharts line chart, monthly paid revenue for the trailing 12 months. Gives the "chats plus numbers" mix you asked for.

---

### New server function

**`src/lib/admin.functions.ts`** (file exists — add one export, do not refactor existing ones)

```ts
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Role gate: admin only
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some(r => r.role === "admin")) throw new Error("Forbidden");

    // Run all reads in parallel using supabaseAdmin (RLS-bypassing) since
    // the gate above already confirmed admin. Returns plain DTO:
    return {
      kpis: {
        openJobs, liveApplications, candidatesThisWeek, shortlisted,
      },
      revenue: {
        month, quarter, year,
        trend: [{ month: "2025-06", amount: 12000 }, ...12 entries],
      },
      funnel: [{ stage: "Sourced", count: 42 }, ...],
      topClients: [{ id, name, openRoles: 5 }, ...top 5],
      recentActivity: [...last 10 events with actor + ad title joined],
    };
  });
```

All aggregation done in 5-6 parallel `supabase.from(...).select(...)` calls + in-memory roll-up. No new SQL views, no DB changes.

---

### New / edited files

**Replace:**
- `src/routes/_authenticated.main.index.tsx` — currently redirects to `/talentportal/main`. Replace with a real dashboard component that loads `adminDashboardQuery` via `ensureQueryData` + `useSuspenseQuery`.

**Edit:**
- `src/lib/admin.functions.ts` — append `getAdminDashboard` (single new export).

**New (small component):**
- `src/components/portal/TopClientsChart.tsx` — recharts horizontal bar.
- `src/components/portal/RevenueTrendChart.tsx` — recharts line.

**Untouched:** `StatCard`, `PipelineFunnel`, `RecentActivity`, `AppSidebar`, `_authenticated.main.tsx` layout, all DB tables, RLS, login.

---

### Layout sketch

```text
┌─────────────────────────────────────────────────────────────┐
│  Admin overview                                             │
├──────────┬──────────┬──────────┬──────────┐
│ Open jobs│ Live apps│ This wk  │Shortlist │  ← KPI tiles
├──────────┼──────────┼──────────┤
│ Rev MTD  │ Rev QTD  │ Rev YTD  │           ← Revenue tiles
├──────────┴──────────┼──────────┴──────────┤
│  Pipeline funnel    │  Top clients (bar)  │  ← Charts
├─────────────────────┼─────────────────────┤
│  Recent activity    │  Revenue trend      │  ← Mix
└─────────────────────┴─────────────────────┘
```

---

### Guardrails followed

- ✅ One server-fn round trip per page (single `getAdminDashboard`).
- ✅ Auth gate stays in `_authenticated.tsx` + `_authenticated.main.tsx` (admin-only); the server fn re-checks server-side.
- ✅ No DB migration, no new RLS, no new auth, no new providers.
- ✅ `recharts` already in deps (used by `src/components/ui/chart.tsx`) — no new packages.
- ✅ Public `/apply/$slug` flow untouched.

---

### Verification

- Log in as admin → land on `/main` → see all 4 KPI tiles, 3 revenue tiles, funnel, top-clients bar, activity feed, revenue trend line.
- Numbers match a manual `SELECT count(*)` spot check on `job_ads`, `applications`, `payments`.
- Member logs in → unchanged (still redirects to `/staff`).
- Client logs in → unchanged (still redirects to `/client`).
- Network tab: exactly one `getAdminDashboard` request on page load.

---

**Files touched:** 1 server fn appended, 1 route replaced, 2 small chart components added = 4 files. No DB changes. No new dependencies.