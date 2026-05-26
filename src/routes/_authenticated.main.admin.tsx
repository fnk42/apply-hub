import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getMyRoles,
} from "@/lib/candidates.functions";
import {
  listPayments,
  setPaymentStatus,
  getAppSettings,
  updateAppSettings,
  listAllJobAds,
  listInternalUsers,
  inviteInternalUser,
  resendInternalInvite,
  setUserRole,
  removeInternalUser,
} from "@/lib/admin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

const jobAdsQ = queryOptions({
  queryKey: ["admin-job-ads"],
  queryFn: () => listAllJobAds(),
  staleTime: 30_000,
});

const teamQ = queryOptions({
  queryKey: ["admin-team"],
  queryFn: () => listInternalUsers(),
});

export function formatKES(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `KES ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export const Route = createFileRoute("/_authenticated/main/admin")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal" });
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(paymentsQ),
      context.queryClient.ensureQueryData(settingsQ),
      context.queryClient.ensureQueryData(jobAdsQ),
      context.queryClient.ensureQueryData(teamQ),
    ]);
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Job ads, billing and workspace configuration.
          </p>
        </div>
        <Link
          to="/staff/jobs/new"
          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          + New job ad
        </Link>
      </div>
      <Tabs defaultValue="jobs" className="mt-6">
        <TabsList>
          <TabsTrigger value="jobs">Job Ads</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="mt-6">
          <JobAdsTab />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobAdsTab() {
  const { data } = useSuspenseQuery(jobAdsQ);
  const [filter, setFilter] = useState<"all" | "pending_authorization" | "live" | "closed">("all");

  const rows = data.ads.filter((a) => filter === "all" || a.status === filter);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {([
          ["all", "All"],
          ["pending_authorization", "Pending"],
          ["live", "Live"],
          ["closed", "Closed"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              filter === k
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No job ads in this view.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Roles</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.client?.name ?? "—"}</TableCell>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>
                    <AdStatusPill status={a.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.roles_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.is_billable ? formatKES(a.posting_fee) : "—"}
                  </TableCell>
                  <TableCell>
                    <BillingPill state={a.billing_state} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/staff/jobs/$slug"
                      params={{ slug: a.slug }}
                      className="text-sm text-primary hover:underline"
                    >
                      Open →
                    </Link>
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

function AdStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    live: { label: "Live", cls: "bg-emerald-500/10 text-emerald-700" },
    pending_authorization: { label: "Pending", cls: "bg-amber-500/10 text-amber-700" },
    draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-600" },
    closed: { label: "Closed", cls: "bg-slate-500/10 text-slate-700" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

function BillingPill({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-emerald-500/10 text-emerald-700" },
    pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-700" },
    triggered: { label: "Triggered", cls: "bg-blue-500/10 text-blue-700" },
    awaiting_10: { label: "Awaiting 10", cls: "bg-slate-500/10 text-slate-600" },
    not_billable: { label: "Not billable", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[state] ?? { label: state, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

function BillingTab() {
  const { data } = useSuspenseQuery(paymentsQ);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "void">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = data.payments.filter((p) => filter === "all" || p.status === filter);

  const NEXT: Record<string, "pending" | "paid" | "void"> = {
    pending: "paid",
    paid: "void",
    void: "pending",
  };

  async function cycle(id: string, current: string) {
    setBusy(id);
    try {
      const next = NEXT[current] ?? "pending";
      await setPaymentStatus({ data: { id, status: next } });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-job-ads"] });
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
                <TableHead className="text-right">Paid</TableHead>
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
                    {formatKES(p.amount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.triggered_by === "auto_10_candidates" ? "Auto (10 cand.)" : "Manual"}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusPill
                      status={p.status}
                      busy={busy === p.id}
                      onClick={() => cycle(p.id, p.status)}
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {p.status === "paid" && p.paid_at
                      ? format(new Date(p.paid_at), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Click a status pill to cycle: pending → paid → void → pending.
      </p>
    </div>
  );
}

function PaymentStatusPill({
  status,
  busy,
  onClick,
}: {
  status: string;
  busy: boolean;
  onClick: () => void;
}) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20",
    paid: "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
    void: "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20",
  };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={busy}
      title="Click to cycle status"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors disabled:opacity-50",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {busy ? "…" : status}
    </button>
  );
}

function SettingsTab() {
  const { data } = useSuspenseQuery(settingsQ);
  const qc = useQueryClient();
  const [appName, setAppName] = useState(data.appName);
  const [fee, setFee] = useState(String(data.defaultPostingFee));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const feeNum = Math.round(parseFloat(fee || "0"));
      if (Number.isNaN(feeNum) || feeNum < 0) {
        toast.error("Enter a valid fee");
        return;
      }
      await updateAppSettings({
        data: { appName: appName.trim(), defaultPostingFee: feeNum },
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
        <Label htmlFor="fee">Default posting fee (KES)</Label>
        <Input
          id="fee"
          type="number"
          min={0}
          step={1}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
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

function TeamTab() {
  const { data } = useSuspenseQuery(teamQ);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState<string | null>(null);

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: ["admin-team"] });
  }

  async function doInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy("invite");
    try {
      await inviteInternalUser({ data: { email: trimmed, role } });
      toast.success(`Access granted to ${trimmed}`);
      setEmail("");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setBusy(null);
    }
  }

  async function doSetRole(userId: string, newRole: "admin" | "member") {
    setBusy(userId);
    try {
      await setUserRole({ data: { user_id: userId, role: newRole } });
      toast.success("Role updated");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function doRemove(userId: string) {
    setBusy(userId);
    try {
      await removeInternalUser({ data: { user_id: userId } });
      toast.success("Access revoked");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function doResend(userId: string, userEmail: string) {
    setBusy(userId);
    try {
      await resendInternalInvite({ data: { email: userEmail } });
      toast.success(`Invite re-sent to ${userEmail}`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Grant portal access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only people you add here can sign in to the recruiter portal. Anyone
          else who tries to log in (Google or email) will be denied. We'll send
          them an email invite to set their password.
        </p>
        <form
          onSubmit={doInvite}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy === "invite"}>
            {busy === "invite" ? "Granting…" : "Grant access"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Team members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone with current access to the recruiter portal.
          </p>
        </div>
        {data.users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No team members yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Last invited</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => {
                const currentRole = u.roles.includes("admin") ? "admin" : "member";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRole}
                        onValueChange={(v) =>
                          doSetRole(u.id, v as "admin" | "member")
                        }
                        disabled={busy === u.id}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? format(new Date(u.last_sign_in_at), "d MMM yyyy")
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.invited_at
                        ? format(new Date(u.invited_at), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === u.id}
                          onClick={() => doResend(u.id, u.email)}
                        >
                          Resend invite
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === u.id}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              Revoke
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.email} will no longer be able to sign in to
                                the recruiter portal. Their auth account stays,
                                but all roles are removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => doRemove(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
