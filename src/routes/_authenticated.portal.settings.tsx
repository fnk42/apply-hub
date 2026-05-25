import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyRoles } from "@/lib/candidates.functions";
import {
  listInternalUsers,
  inviteInternalUser,
  setUserRole,
  removeInternalUser,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { format } from "date-fns";

const rolesQ = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
});

const usersQ = queryOptions({
  queryKey: ["internal-users"],
  queryFn: () => listInternalUsers(),
});

export const Route = createFileRoute("/_authenticated/portal/settings")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(rolesQ);
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { data: rolesData } = useSuspenseQuery(rolesQ);
  const isAdmin = rolesData.roles.includes("admin");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="font-serif text-4xl tracking-tight text-foreground">Team & access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isAdmin ? "Invite, manage, and revoke portal access." : "Your workspace access."}
      </p>

      {isAdmin ? (
        <UsersAdmin />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Only admins can manage workspace settings.
          </p>
        </div>
      )}
    </div>
  );
}

function RoleLegend() {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p>
        <span className="font-semibold text-foreground">Admin</span> — full access: add candidates, create/close job ads, manage clients, delete records, manage team, export data.
      </p>
      <p className="mt-1">
        <span className="font-semibold text-foreground">Member</span> — change stage, fit, shortlist, and notes; download individual CVs. Cannot add candidates, manage clients/job ads, or export bulk data.
      </p>
    </div>
  );
}

function UsersAdmin() {
  const { data } = useSuspenseQuery(usersQ);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function changeRole(userId: string, role: "admin" | "member") {
    setBusy(userId);
    try {
      await setUserRole({ data: { user_id: userId, role } });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["internal-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(userId: string) {
    if (!confirm("Remove access for this user?")) return;
    setBusy(userId);
    try {
      await removeInternalUser({ data: { user_id: userId } });
      toast.success("Access removed");
      qc.invalidateQueries({ queryKey: ["internal-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Team members</h2>
        <InviteUserDialog
          onInvited={() => qc.invalidateQueries({ queryKey: ["internal-users"] })}
        />
      </div>
      <div className="mt-4 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.map((u) => {
              const currentRole = u.roles.includes("admin") ? "admin" : "member";
              const isActive = !!u.last_sign_in_at;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={currentRole}
                      onValueChange={(v) => changeRole(u.id, v as "admin" | "member")}
                      disabled={busy === u.id}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                        (isActive
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-500/10 text-amber-700")
                      }
                    >
                      {isActive ? "Active" : "Pending"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_sign_in_at
                      ? format(new Date(u.last_sign_in_at), "d MMM yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === u.id}
                      onClick={() => remove(u.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <RoleLegend />
    </section>
  );
}

function InviteUserDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await inviteInternalUser({ data: { email: email.trim(), role } });
      toast.success("Invite sent");
      setEmail("");
      setRole("member");
      setOpen(false);
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
