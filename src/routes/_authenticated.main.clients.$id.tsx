import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { getMyRoles, getClientDetail, updateClient } from "@/lib/candidates.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

function formatKES(n: number | null | undefined) {
  if (n == null) return "—";
  return `KES ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

const clientDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin-client", id],
    queryFn: () => getClientDetail({ data: { client_id: id } }),
  });

export const Route = createFileRoute("/_authenticated/main/clients/$id")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal" });
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clientDetailQuery(params.id)),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(clientDetailQuery(id));
  const qc = useQueryClient();
  const { client, job_ads, payments } = data;
  const [editOpen, setEditOpen] = useState(false);

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
      <Link to="/main/clients" className="text-sm text-muted-foreground hover:text-foreground">
        ← Clients
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{client.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.contact_name ?? "—"} · {client.contact_email ?? "—"}
          </p>
          {client.notes && (
            <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" /> Edit client
        </Button>
      </div>

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
                  <Link to="/staff/jobs/$slug" params={{ slug: a.slug }} className="font-medium hover:underline">
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

      <EditClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-client", id] });
          qc.invalidateQueries({ queryKey: ["admin-clients"] });
        }}
      />
    </div>
  );
}

function EditClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: { id: string; name: string; contact_name: string | null; contact_email: string | null; notes: string | null; contract_ad_allowance: number };
  onSaved: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [contactName, setContactName] = useState(client.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(client.contact_email ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [allowance, setAllowance] = useState(client.contract_ad_allowance);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      await updateClient({
        data: {
          client_id: client.id,
          patch: {
            name: name.trim(),
            contact_name: contactName.trim() || null,
            contact_email: contactEmail.trim() || null,
            notes: notes.trim() || null,
            contract_ad_allowance: allowance,
          },
        },
      });
      toast.success("Client updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-client-name">Client name</Label>
            <Input id="edit-client-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-client-contact-name">Contact name</Label>
            <Input id="edit-client-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-client-contact-email">Contact email</Label>
            <Input id="edit-client-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-client-allowance">Contract ad allowance</Label>
            <Input
              id="edit-client-allowance"
              type="number"
              min={0}
              value={allowance}
              onChange={(e) => setAllowance(Math.max(0, parseInt(e.target.value || "0", 10)))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-client-notes">Notes</Label>
            <Textarea id="edit-client-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
