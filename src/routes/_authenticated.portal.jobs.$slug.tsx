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
import { openResumeInNewTab } from "@/lib/open-resume";
import { setJobAdStatus } from "@/lib/jobs.functions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FitBadge,
  FIT_LABELS,
} from "@/components/portal/Badges";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Linkedin,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Star,
} from "lucide-react";
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
  staleTime: 60_000,
});


export const Route = createFileRoute("/_authenticated/portal/jobs/$slug")({
  loader: async ({ context, params }) => {
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
    await Promise.all([
      context.queryClient.ensureQueryData(candidatesQuery(ad.id)),
      context.queryClient.ensureQueryData(stagesQuery(ad.id)),
      context.queryClient.ensureQueryData(rolesQuery),
    ]);
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
  const { data: stagesData } = useSuspenseQuery(stagesQuery(ad.id));
  const { data: rolesData } = useSuspenseQuery(rolesQuery);
  const isAdmin = rolesData.roles.includes("admin");
  const stages = stagesData.stages;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"inbound" | "sourced">("inbound");
  const [search, setSearch] = useState("");
  const [fit, setFit] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [shortlist, setShortlist] = useState<string>("all");
  const [jdExpanded, setJdExpanded] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const all = candData.candidates;
  const inboundCount = all.filter((c) => c.source === "public_form").length;
  const sourcedCount = all.filter((c) => c.source === "manual").length;

  // Resolve a candidate's stage_id, falling back to legacy_status mapping if missing
  const resolveStageId = (c: typeof all[number]): string | null => {
    if (c.stage_id) return c.stage_id;
    const match = stages.find((s) => s.legacy_status === c.pipeline_status);
    return match?.id ?? null;
  };

  const rows = all.filter((c) => {
    const wantSource = tab === "inbound" ? "public_form" : "manual";
    if (c.source !== wantSource) return false;
    if (fit !== "all" && c.fit !== fit) return false;
    if (stageFilter !== "all" && resolveStageId(c) !== stageFilter) return false;
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

  async function changeStage(id: string, stageId: string) {
    try {
      await updateCandidate({ data: { id, patch: { stage_id: stageId } } });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }


  async function doSetStatus(next: "closed" | "live") {
    setStatusBusy(true);
    try {
      await setJobAdStatus({ data: { id: ad.id, status: next } });
      qc.invalidateQueries({ queryKey: ["job-ad", slug] });
      qc.invalidateQueries({ queryKey: ["portal-shell"] });
      toast.success(next === "closed" ? "Ad closed" : "Ad reopened");
      setCloseOpen(false);
      setReopenOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setStatusBusy(false);
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
            {isAdmin && ad.status !== "closed" && (
              <Button
                variant="outline"
                onClick={() => setCloseOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Lock className="mr-1 h-4 w-4" /> Close ad
              </Button>
            )}
            {isAdmin && ad.status === "closed" && (
              <Button variant="outline" onClick={() => setReopenOpen(true)}>
                <RotateCcw className="mr-1 h-4 w-4" /> Reopen ad
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline">
                <Link to="/portal/jobs/$slug/stages" params={{ slug }}>
                  <Settings2 className="mr-1 h-4 w-4" /> Stages
                </Link>
              </Button>
            )}
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/portal/jobs/$slug/add-candidate" params={{ slug }}>
                <Plus className="mr-1 h-4 w-4" /> Add candidate
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* JD Panel */}
      <JdPanel
        ad={ad}
        isAdmin={isAdmin}
        expanded={jdExpanded}
        onToggle={() => setJdExpanded((v) => !v)}
      />

      {ad.status === "live" && <ShareLinkCard slug={ad.slug} />}

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this ad?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing candidates remain visible, but no new applications will be accepted on
              the public apply link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doSetStatus("closed");
              }}
              disabled={statusBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {statusBusy ? "Closing…" : "Close ad"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this ad?</AlertDialogTitle>
            <AlertDialogDescription>
              The ad will go live again and start accepting applications on the public apply
              link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doSetStatus("live");
              }}
              disabled={statusBusy}
            >
              {statusBusy ? "Reopening…" : "Reopen ad"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



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
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
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
                <TableHead className="w-[90px]">Resume</TableHead>
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
                    {(() => {
                      const sid = resolveStageId(c);
                      const cur = sid ? stageById.get(sid) : null;
                      return (
                        <Select
                          value={sid ?? ""}
                          onValueChange={(v) => changeStage(c.id, v)}
                        >
                          <SelectTrigger className="h-8 w-full border-none bg-transparent p-0 shadow-none focus:ring-0">
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {cur?.label ?? "—"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <FitBadge value={c.fit} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ResumeLink path={(c as any).resume_url ?? null} />
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

function ShareLinkCard({ slug }: { slug: string }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/apply/${slug}`
      : `/apply/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Public apply link
        </span>
        <code className="truncate text-sm">{url}</code>
      </div>
      <Button variant="outline" size="sm" onClick={copy}>
        <Copy className="mr-1 h-4 w-4" /> Copy
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-1 h-4 w-4" /> Open
        </a>
      </Button>
    </div>
  );
}

function JdPanel({
  ad,
  isAdmin,
  expanded,
  onToggle,
}: {
  ad: {
    jd_text: string | null;
    jd_url: string | null;
    linkedin_job_url: string | null;
    posting_fee?: number | null;
    is_billable?: boolean | null;
    billing_triggered_at?: string | null;
  };
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasJdText = !!(ad.jd_text && ad.jd_text.trim());
  const hasAnyLink = !!(ad.jd_url || ad.linkedin_job_url);
  if (!hasJdText && !hasAnyLink && !isAdmin) return null;

  const fee = (ad as any).posting_fee as number | null | undefined;
  const billable = !!(ad as any).is_billable;
  const triggered = (ad as any).billing_triggered_at as string | null | undefined;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <h2 className="font-serif text-xl tracking-tight">Job description</h2>
        <div className="flex items-center gap-2">
          {ad.linkedin_job_url && (
            <a
              href={ad.linkedin_job_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </a>
          )}
          {ad.jd_url && (
            <a
              href={ad.jd_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              <FileText className="h-3.5 w-3.5" /> JD link
            </a>
          )}
          {hasJdText && (
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" /> Show more
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {hasJdText && (
        <div className="border-t border-border px-6 py-4">
          <pre
            className={cn(
              "whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90",
              !expanded && "line-clamp-6",
            )}
          >
            {ad.jd_text}
          </pre>
        </div>
      )}

      {!hasJdText && !hasAnyLink && isAdmin && (
        <div className="border-t border-border px-6 py-4 text-sm italic text-muted-foreground">
          No JD text or links added yet.
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
          <span>
            Billable:{" "}
            <span className="font-medium text-foreground">
              {billable ? "Yes" : "No"}
            </span>
          </span>
          <span>
            Posting fee:{" "}
            <span className="font-medium text-foreground">
              {typeof fee === "number" && fee > 0
                ? `KES ${fee.toLocaleString("en-KE")}`
                : "—"}
            </span>
          </span>
          <span>
            Billing:{" "}
            <span className="font-medium text-foreground">
              {triggered
                ? `triggered ${format(new Date(triggered), "d MMM yyyy")}`
                : billable
                  ? "pending (auto at 10 candidates)"
                  : "n/a"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function ResumeLink({ path }: { path: string | null }) {
  const [busy, setBusy] = useState(false);
  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  async function open(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await getResumeSignedUrl({ data: { path: path! } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Could not open resume");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
    >
      <FileText className="h-3 w-3" />
      {busy ? "Opening…" : "View"}
    </button>
  );
}



