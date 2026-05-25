import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getMyRoles, getClientDetail } from "@/lib/candidates.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatKES(n: number | null | undefined) {
  if (n == null) return "—";
  return `KES ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export const Route = createFileRoute("/_authenticated/portal/clients/$id")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal" });
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["admin-client", params.id],
        queryFn: () => getClientDetail({ data: { client_id: params.id } }),
      }),
    ),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["admin-client", id],
      queryFn: () => getClientDetail({ data: { client_id: id } }),
    }),
  );
  const { client, job_ads, payments } = data;

  const expected = payments
    .filter((p) => p.status === "pending" || p.status === "paid")
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const liveRoles = job_ads
    .filter((a) => a.status === "live")
    .reduce((s, a) => s + (a.roles_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link to="/portal/clients" className="text-sm text-muted-foreground hover:text-foreground">
        ← Clients
      </Link>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">{client.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {client.contact_name ?? "—"} · {client.contact_email ?? "—"}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Live roles" value={String(liveRoles)} />
        <Stat label="Open ads" value={String(job_ads.filter((a) => a.status !== "closed").length)} />
        <Stat label="Expected" value={formatKES(expected)} />
        <Stat label="Collected" value={formatKES(collected)} />
      </div>

      <h2 className="mt-10 font-serif text-2xl">Job ads</h2>
      <div className="mt-3 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Roles</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {job_ads.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link to="/portal/jobs/$slug" params={{ slug: a.slug }} className="font-medium hover:underline">
                    {a.title}
                  </Link>
                </TableCell>
                <TableCell className="text-sm capitalize">{a.status.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right tabular-nums">{a.roles_count}</TableCell>
                <TableCell className="text-right tabular-nums">{a.is_billable ? formatKES(a.posting_fee) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(a.created_at), "d MMM yyyy")}
                </TableCell>
              </TableRow>
            ))}
            {job_ads.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No job ads.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <h2 className="mt-10 font-serif text-2xl">Payments</h2>
      <div className="mt-3 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "d MMM yyyy")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKES(p.amount)}</TableCell>
                <TableCell className="capitalize text-sm">{p.status}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.triggered_by === "auto_10_candidates" ? "Auto (10 cand.)" : "Manual"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.paid_at ? format(new Date(p.paid_at), "d MMM yyyy") : "—"}
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No payments.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
