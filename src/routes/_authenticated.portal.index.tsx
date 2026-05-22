import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/candidates.functions";
import { StatCard } from "@/components/portal/StatCard";
import { PipelineFunnel } from "@/components/portal/PipelineFunnel";
import { RecentActivity } from "@/components/portal/RecentActivity";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const dashQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: () => getDashboardStats(),
});

export const Route = createFileRoute("/_authenticated/portal/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(dashQuery);
  const { stats, funnel, recent } = data;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-foreground">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline activity this week
          </p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/portal/new">
            <Plus className="mr-1 h-4 w-4" /> Add candidate
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Inbound this week"
          value={stats.inbound_this_week}
          accent="green"
          delta={{ current: stats.inbound_this_week, previous: stats.inbound_last_week }}
        />
        <StatCard
          label="Sourced this week"
          value={stats.sourced_this_week}
          accent="blue"
          delta={{ current: stats.sourced_this_week, previous: stats.sourced_last_week }}
        />
        <StatCard
          label="Shortlisted"
          value={stats.shortlisted_total}
          accent="amber"
        />
        <StatCard
          label="Scheduled"
          value={stats.scheduled_total}
          accent="purple"
        />
        <StatCard
          label="Rejected at screening"
          value={stats.rejected_total}
          accent="rose"
        />
        <StatCard
          label="Candidate declined"
          value={stats.declined_total}
          accent="slate"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel stages={funnel} />
        </div>
        <div>
          <RecentActivity events={recent} />
        </div>
      </div>
    </div>
  );
}
