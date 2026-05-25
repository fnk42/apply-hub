import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAdminDashboard } from "@/lib/admin.functions";
import { StatCard } from "@/components/portal/StatCard";
import { PipelineFunnel } from "@/components/portal/PipelineFunnel";
import { RecentActivity } from "@/components/portal/RecentActivity";
import { TopClientsChart } from "@/components/portal/TopClientsChart";
import { RevenueTrendChart } from "@/components/portal/RevenueTrendChart";

const dashboardQuery = queryOptions({
  queryKey: ["admin-dashboard"],
  queryFn: () => getAdminDashboard(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/main/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: AdminDashboard,
});

function fmtKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function AdminDashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live pipeline and revenue at a glance.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Open jobs" value={data.kpis.openJobs} accent="green" />
        <StatCard label="Live applications" value={data.kpis.liveApplications} accent="blue" />
        <StatCard label="Added this week" value={data.kpis.candidatesThisWeek} accent="purple" />
        <StatCard label="Shortlisted" value={data.kpis.shortlisted} accent="amber" />
      </div>

      {/* Revenue tiles */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Revenue this month" value={fmtKES(data.revenue.month)} accent="rose" />
        <StatCard label="Revenue this quarter" value={fmtKES(data.revenue.quarter)} accent="rose" />
        <StatCard label="Revenue this year" value={fmtKES(data.revenue.year)} accent="rose" />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnel stages={data.funnel} />
        <TopClientsChart items={data.topClients} />
      </div>

      {/* Activity + trend */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity events={data.recentActivity} />
        <RevenueTrendChart data={data.revenue.trend} />
      </div>
    </div>
  );
}
