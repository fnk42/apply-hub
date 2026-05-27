import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPortalShell, getMyRoles } from "@/lib/candidates.functions";
import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const shellQuery = queryOptions({
  queryKey: ["portal-shell"],
  queryFn: () => getPortalShell(),
  staleTime: 30_000,
});

const rolesQuery = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_authenticated/jobs/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(shellQuery),
      context.queryClient.ensureQueryData(rolesQuery),
    ]),
  component: JobsIndexPage,
});

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "live", label: "Live", statuses: ["live"] },
  { key: "pending", label: "Pending authorization", statuses: ["pending_authorization", "draft"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
];

function JobsIndexPage() {
  const { data } = useSuspenseQuery(shellQuery);
  const { data: rolesData } = useSuspenseQuery(rolesQuery);
  const isAdmin = rolesData.roles.includes("admin");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-foreground">Job Ads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All job ads across clients, grouped by status.
          </p>
        </div>
        {isAdmin && (
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/staff/jobs/new">
              <Plus className="mr-1 h-4 w-4" /> New job ad
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {GROUPS.map((g) => {
          const items = data.ads.filter((a) => g.statuses.includes(a.status));
          return (
            <section key={g.key}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-serif text-2xl tracking-tight">{g.label}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ads in this group.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => (
                    <Link
                      key={a.id}
                      to="/jobs/$slug"
                      params={{ slug: a.slug }}
                      className={cn(
                        "group rounded-lg border border-border bg-card p-5 transition hover:border-accent",
                      )}
                    >
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                      <div className="mt-3 font-serif text-xl tracking-tight">
                        {a.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {a.count} candidate{a.count === 1 ? "" : "s"}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
