import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyRoles,
  listClients,
  inviteClient,
  createClient,
} from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Plus } from "lucide-react";


const clientsQuery = queryOptions({
  queryKey: ["admin-clients"],
  queryFn: () => listClients(),
});

export const Route = createFileRoute("/_authenticated/portal/clients")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsQuery),
  component: ClientsPage,
});

function ClientsPage() {
  const { data } = useSuspenseQuery(clientsQuery);
  const qc = useQueryClient();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function handleInvite(id: string, defaultEmail: string | null) {
    const email = (emails[id] ?? defaultEmail ?? "").trim();
    if (!email) {
      toast.error("Enter an email first");
      return;
    }
    setBusy(id);
    try {
      await inviteClient({ data: { client_id: id, email } });
      toast.success("Invite sent");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="font-serif text-4xl tracking-tight">Clients</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Invite a client to log in. They&apos;ll see only their own job ads and
        candidates.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[180px] text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.contact_name ?? "—"}
                </TableCell>
                <TableCell>
                  <Input
                    type="email"
                    defaultValue={c.contact_email ?? ""}
                    onChange={(e) =>
                      setEmails((m) => ({ ...m, [c.id]: e.target.value }))
                    }
                    placeholder="client@example.com"
                    className="h-8"
                  />
                </TableCell>
                <TableCell className="text-right">
                  {c.auth_user_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Invited
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy === c.id}
                      onClick={() => handleInvite(c.id, c.contact_email)}
                    >
                      {busy === c.id ? "Sending…" : "Invite"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
