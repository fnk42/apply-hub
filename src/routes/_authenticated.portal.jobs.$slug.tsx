import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import {
  getJobAdBySlug,
  getMyRoles,
  listCandidates,
  listJobAdStages,
  updateCandidate,
} from "@/lib/candidates.functions";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FitBadge,
  FIT_LABELS,
} from "@/components/portal/Badges";
import { ExternalLink, FileText, Linkedin, Plus, Search, Settings2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

const adQuery = (slug: string) =>
  queryOptions({
    queryKey: ["job-ad", slug],
    queryFn: () => getJobAdBySlug({ data: { slug } }),
  });

const candidatesQuery = (jobAdId: string) =>
  queryOptions({
    queryKey: ["candidates", "by-ad", jobAdId],
    queryFn: () => listCandidates({ data: { job_ad_id: jobAdId } }),
  });

const stagesQuery = (jobAdId: string) =>
  queryOptions({
    queryKey: ["job-ad-stages", jobAdId],
    queryFn: () => listJobAdStages({ data: { job_ad_id: jobAdId } }),
  });

const rolesQuery = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
});


export const Route = createFileRoute("/_authenticated/portal/jobs/$slug")({
  loader: async ({ context, params }) => {
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
    await context.queryClient.ensureQueryData(candidatesQuery(ad.id));
  },
  component: JobAdDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Job ad not found</h1>
      <Link to="/portal/jobs" className="mt-4 inline-block text-primary hover:underline">
        Back to all ads
      </Link>
    </div>
  ),
});

function JobAdDetailPage() {
  const { slug } = Route.useParams();
  const { data: adData } = useSuspenseQuery(adQuery(slug));
  const ad = adData.ad!;
  const client = adData.client;
  const stats = adData.stats!;
  const { data: candData } = useSuspenseQuery(candidatesQuery(ad.id));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"inbound" | "sourced">("inbound");
  const [search, setSearch] = useState("");
  const [fit, setFit] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [shortlist, setShortlist] = useState<string>("all");

  const all = candData.candidates;
  const inboundCount = all.filter((c) => c.source === "public_form").length;
  const sourcedCount = all.filter((c) => c.source === "manual").length;

  const rows = all.filter((c) => {
    const wantSource = tab === "inbound" ? "public_form" : "manual";
    if (c.source !== wantSource) return false;
    if (fit !== "all" && c.fit !== fit) return false;
    if (status !== "all" && c.pipeline_status !== status) return false;
    if (shortlist === "on" && !c.shortlisted) return false;
    if (shortlist === "off" && c.shortlisted) return false;
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

  const daysLive = ad.authorized_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(ad.authorized_at).getTime()) / 86400000,
        ),
      )
    : null;

  async function toggleShortlist(id: string, current: boolean) {
    try {
      await updateCandidate({ data: { id, patch: { shortlisted: !current } } });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-ad", slug] });
      toast.success(current ? "Removed from shortlist" : "Added to shortlist");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function changeStatus(id: string, v: string) {
    try {
      await updateCandidate({ data: { id, patch: { pipeline_status: v as any } } });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider",
                  ad.status === "live"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : ad.status === "closed"
                      ? "bg-slate-500/10 text-slate-700"
                      : "bg-amber-500/10 text-amber-700",
                )}
              >
                {ad.status.replace("_", " ")}
              </span>
              {client && (
                <span className="text-sm text-muted-foreground">· {client.name}</span>
              )}
            </div>
            <h1 className="mt-2 font-serif text-4xl tracking-tight">{ad.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{ad.roles_count} role{ad.roles_count === 1 ? "" : "s"}</span>
              {ad.start_date && <span>Start: {format(new Date(ad.start_date), "d MMM yyyy")}</span>}
              {daysLive !== null && <span>{daysLive} day{daysLive === 1 ? "" : "s"} live</span>}
              <span>{stats.app_count} application{stats.app_count === 1 ? "" : "s"}</span>
              <span>{stats.shortlist_count} shortlisted</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ad.linkedin_job_url ? (
              <a
                href={ad.linkedin_job_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                No LinkedIn URL set
              </span>
            )}
            {ad.jd_url && (
              <a
                href={ad.jd_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <FileText className="h-4 w-4" /> View JD
              </a>
            )}
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/portal/new">
                <Plus className="mr-1 h-4 w-4" /> Add candidate
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Candidates */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
        <TabsList>
          <TabsTrigger value="inbound">
            Inbound{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {inboundCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="sourced">
            Sourced{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {sourcedCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fit} onValueChange={setFit}>
          <SelectTrigger className="w-[140px] rounded-full">
            <SelectValue placeholder="Fit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fits</SelectItem>
            {Object.entries(FIT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shortlist} onValueChange={setShortlist}>
          <SelectTrigger className="w-[160px] rounded-full">
            <SelectValue placeholder="Shortlist" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All candidates</SelectItem>
            <SelectItem value="on">On shortlist</SelectItem>
            <SelectItem value="off">Not shortlisted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground">
              {all.length === 0
                ? "No candidates yet."
                : tab === "inbound"
                  ? "No inbound applications match your filters."
                  : "No sourced candidates match your filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date sourced</TableHead>
                <TableHead className="w-[80px] text-right">YOE</TableHead>
                <TableHead className="w-[200px]">Stage</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead className="w-[100px] text-center">Shortlist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/portal/$id", params: { id: c.id } })}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <NameCell name={c.full_name} linkedinUrl={c.linkedin_url} />
                      <span className="text-xs text-muted-foreground">
                        {c.current_company || "Independent"}
                      </span>
                      {c.current_title && (
                        <span className="text-xs text-muted-foreground/80">
                          {c.current_title}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.years_of_experience ?? "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={c.pipeline_status}
                      onValueChange={(v) => changeStatus(c.id, v)}
                    >
                      <SelectTrigger className="h-8 w-full border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <StatusBadge value={c.pipeline_status} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <FitBadge value={c.fit} />
                  </TableCell>
                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleShortlist(c.id, !!c.shortlisted)}
                      aria-label={c.shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                      className="inline-flex p-1"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4 transition-colors",
                          c.shortlisted
                            ? "fill-accent stroke-accent"
                            : "stroke-muted-foreground hover:stroke-foreground",
                        )}
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
