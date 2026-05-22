import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { listCandidates, updateCandidate } from "@/lib/candidates.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FitBadge, StatusBadge } from "@/components/portal/Badges";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const shortlistQuery = queryOptions({
  queryKey: ["candidates", "shortlist"],
  queryFn: () => listCandidates({ data: { shortlisted: true } }),
});

export const Route = createFileRoute("/_authenticated/portal/shortlist")({
  loader: ({ context }) => context.queryClient.ensureQueryData(shortlistQuery),
  component: ShortlistPage,
});

function ShortlistPage() {
  const { data } = useSuspenseQuery(shortlistQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rows = data.candidates;

  async function removeFromShortlist(id: string) {
    try {
      await updateCandidate({ data: { id, patch: { shortlisted: false } } });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Removed from shortlist");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-foreground">
          Your shortlist
        </h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Candidates flagged for client review.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground">
              No candidates on the shortlist yet. Tap the star icon on a candidate row to add them.
            </p>
            <Link
              to="/portal/candidates"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Browse candidates →
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[80px] text-right">YOE</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead className="w-[100px] text-center">Remove</TableHead>
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
                  <TableCell>
                    <div className="flex flex-col">
                      <NameCell name={c.full_name} linkedinUrl={c.linkedin_url} />
                      <span className="text-xs text-muted-foreground">
                        {c.current_company || "Independent"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.years_of_experience ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={c.pipeline_status} />
                  </TableCell>
                  <TableCell>
                    <FitBadge value={c.fit} />
                  </TableCell>
                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => removeFromShortlist(c.id)}
                      aria-label="Remove from shortlist"
                      className="inline-flex p-1"
                    >
                      <Star
                        className={cn("h-4 w-4 fill-accent stroke-accent")}
                      />
                    </button>
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

function NameCell({
  name,
  linkedinUrl,
}: {
  name: string;
  linkedinUrl: string | null;
}) {
  const isUrl = linkedinUrl && /^https?:\/\//i.test(linkedinUrl);
  if (isUrl) {
    return (
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        {name}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return <span className="font-medium">{name}</span>;
}
