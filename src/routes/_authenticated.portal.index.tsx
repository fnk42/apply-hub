import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCandidates } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FitBadge,
  StatusBadge,
  FIT_LABELS,
  STATUS_LABELS,
} from "@/components/portal/Badges";
import { Plus, Search } from "lucide-react";

const candidatesQuery = queryOptions({
  queryKey: ["candidates"],
  queryFn: () => listCandidates({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/portal/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(candidatesQuery),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { data } = useSuspenseQuery(candidatesQuery);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [fit, setFit] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const rows = data.candidates.filter((c) => {
    if (fit !== "all" && c.fit !== fit) return false;
    if (status !== "all" && c.pipeline_status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.full_name.toLowerCase().includes(s) &&
        !c.email.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Candidates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.candidates.length}{" "}
            {data.candidates.length === 1 ? "applicant" : "applicants"} total
          </p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/portal/new">
            <Plus className="mr-1 h-4 w-4" /> Add candidate
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fit} onValueChange={setFit}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Fit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fits</SelectItem>
            {Object.entries(FIT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Pipeline status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground">
              {data.candidates.length === 0
                ? "No candidates yet. Applications submitted on the public page will appear here."
                : "No candidates match your filters."}
            </p>
            {data.candidates.length === 0 && (
              <Button asChild className="mt-4">
                <Link to="/portal/new">Add the first candidate</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: "/portal/$id", params: { id: c.id } })
                  }
                >
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.source}
                  </TableCell>
                  <TableCell><FitBadge value={c.fit} /></TableCell>
                  <TableCell><StatusBadge value={c.pipeline_status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
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
