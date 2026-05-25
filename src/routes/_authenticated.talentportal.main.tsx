import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { shellQuery } from "./_authenticated.talentportal";

export const Route = createFileRoute("/_authenticated/talentportal/main")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    if (!roles.includes("admin")) {
      if (roles.includes("member")) throw redirect({ to: "/talentportal/staff" });
      if (roles.includes("client")) throw redirect({ to: "/talentportal/client" });
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: MainDashboard,
});

function MainDashboard() {
  const { data } = useSuspenseQuery(shellQuery);
  const live = data.ads.filter((a) => a.status === "live");
  const closed = data.ads.filter((a) => a.status === "closed");
  const pending = data.ads.filter((a) => a.status === "pending_authorization");
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">All clients and job ads at a glance.</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat label="Live" value={live.length} />
        <Stat label="Pending" value={pending.length} />
        <Stat label="Closed" value={closed.length} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/talentportal/clients" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Clients</Link>
          <Link to="/talentportal/jobs" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">All job ads</Link>
          <Link to="/talentportal/admin" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Admin tools</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}
