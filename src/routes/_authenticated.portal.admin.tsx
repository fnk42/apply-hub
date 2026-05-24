import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getMyRoles,
} from "@/lib/candidates.functions";
import {
  listPayments,
  markPaymentPaid,
  voidPayment,
  getAppSettings,
  updateAppSettings,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const paymentsQ = queryOptions({
  queryKey: ["admin-payments"],
  queryFn: () => listPayments(),
});

const settingsQ = queryOptions({
  queryKey: ["admin-settings"],
  queryFn: () => getAppSettings(),
});

export const Route = createFileRoute("/_authenticated/portal/admin")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal" });
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(paymentsQ),
      context.queryClient.ensureQueryData(settingsQ),
    ]);
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-serif text-4xl tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Billing and workspace configuration.
      </p>
      <Tabs defaultValue="billing" className="mt-6">
        <TabsList>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BillingTab() {
  const { data } = useSuspenseQuery(paymentsQ);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "void">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = data.payments.filter((p) => filter === "all" || p.status === filter);

  async function doMarkPaid(id: string) {
    setBusy(id);
    try {
      await markPaymentPaid({ data: { id } });
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  async function doVoid(id: string) {
    setBusy(id);
    try {
      await voidPayment({ data: { id } });
      toast.success("Payment voided");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["all", "pending", "paid", "void"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize",
              filter === k
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No payments yet. Billing is auto-created when the 10th candidate is added to a billable job.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.job?.title ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.currency.toUpperCase()} {(p.amount_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.triggered_by === "auto_10_candidates" ? "Auto (10 cand.)" : "Manual"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === "pending" && (
                      <div className="inline-flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy === p.id}
                          onClick={() => doMarkPaid(p.id)}
                        >
                          Mark paid
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === p.id}
                          onClick={() => doVoid(p.id)}
                        >
                          Void
                        </Button>
                      </div>
                    )}
                    {p.status === "paid" && p.paid_at && (
                      <span className="text-xs text-muted-foreground">
                        Paid {format(new Date(p.paid_at), "d MMM yyyy")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700",
    paid: "bg-emerald-500/10 text-emerald-700",
    void: "bg-slate-500/10 text-slate-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

function SettingsTab() {
  const { data } = useSuspenseQuery(settingsQ);
  const qc = useQueryClient();
  const [appName, setAppName] = useState(data.appName);
  const [feeDollars, setFeeDollars] = useState(
    (data.defaultPostingFeeCents / 100).toString(),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const cents = Math.round(parseFloat(feeDollars || "0") * 100);
      if (Number.isNaN(cents) || cents < 0) {
        toast.error("Enter a valid fee");
        return;
      }
      await updateAppSettings({
        data: { appName: appName.trim(), defaultPostingFeeCents: cents },
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["portal-shell"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="app-name">Workspace name</Label>
        <Input
          id="app-name"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="Project Dashboard"
        />
        <p className="text-xs text-muted-foreground">Shown in the sidebar and header.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fee">Default posting fee (USD)</Label>
        <Input
          id="fee"
          type="number"
          min={0}
          step="0.01"
          value={feeDollars}
          onChange={(e) => setFeeDollars(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Applied to new billable job ads. A payment is auto-created when the 10th candidate is added.
        </p>
      </div>
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
