import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getJobAdBySlug,
  listCandidates,
  listJobAdStages,
} from "@/lib/candidates.functions";
import { openResumeInNewTab } from "@/lib/open-resume";
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
import { FitBadge } from "@/components/portal/Badges";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Linkedin,
  Search,
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

export const Route = createFileRoute("/_authenticated/client/jobs/$slug")({
  loader: async ({ context, params }) => {
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
    await Promise.all([
      context.queryClient.ensureQueryData(candidatesQuery(ad.id)),
      context.queryClient.ensureQueryData(stagesQuery(ad.id)),
    ]);
  },
  component: ClientJobAdView,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Job ad not found</h1>
      <Link to="/client" className="mt-4 inline-block text-primary hover:underline">
        Back
      </Link>
    </div>
  ),
});

function ClientJobAdView() {
  const { slug } = Route.useParams();
  const { data: adData } = useSuspenseQuery(adQuery(slug));
  const ad = adData.ad!;
  const client = adData.client;
  const stats = adData.stats!;
  const { data: candData } = useSuspenseQuery(candidatesQuery(ad.id));
  const { data: stagesData } = useSuspenseQuery(stagesQuery(ad.id));
  const stages = stagesData.stages;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const navigate = useNavigate();

  const [tab, setTab] = useState<"all" | "strong" | "medium" | "shortlist">("all");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [jdExpanded, setJdExpanded] = useState(false);

  const all = candData.candidates;
  const allCount = all.length;
  const strongCount = all.filter((c) => c.fit === "strong").length;
  const mediumCount = all.filter((c) => c.fit === "medium").length;
  const shortlistCount = all.filter((c) => c.shortlisted).length;

  const resolveStageId = (c: typeof all[number]): string | null => {
    if (c.stage_id) return c.stage_id;
    const match = stages.find((s) => s.legacy_status === c.pipeline_status);
    return match?.id ?? null;
  };

  const rows = all.filter((c) => {
    if (tab === "strong" && c.fit !== "strong") return false;
    if (tab === "medium" && c.fit !== "medium") return false;
    if (tab === "shortlist" && !c.shortlisted) return false;
    if (stageFilter !== "all" && resolveStageId(c) !== stageFilter) return false;
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

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tab, stageFilter, search]);
  const totalRows = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const daysLive = ad.authorized_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(ad.authorized_at).getTime()) / 86400000,
        ),
      )
    : null;

  const hasJdText = !!(ad.jd_text && ad.jd_text.trim());

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
        </div>
      </div>

      {/* JD Panel (read-only) */}
      {(hasJdText || ad.linkedin_job_url || ad.jd_url) && (
        <div className="mt-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-6 py-3">
            <h2 className="font-serif text-xl tracking-tight">Job description</h2>
            <div className="flex items-center gap-2">
              {ad.linkedin_job_url && (
                <a
                  href={ad.linkedin_job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
              {ad.jd_url && (
                <a
                  href={ad.jd_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5" /> JD link
                </a>
              )}
              {hasJdText && (
                <button
                  type="button"
                  onClick={() => setJdExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs hover:bg-muted"
                >
                  {jdExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" /> Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" /> Show more
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {hasJdText && (
            <div className="border-t border-border px-6 py-4">
              <pre
                className={cn(
                  "whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90",
                  !jdExpanded && "line-clamp-6",
                )}
              >
                {ad.jd_text}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Candidates (read-only) */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">
            All candidates{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{allCount}</span>
          </TabsTrigger>
          <TabsTrigger value="strong">
            Strong fit{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{strongCount}</span>
          </TabsTrigger>
          <TabsTrigger value="medium">
            Medium fit{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{mediumCount}</span>
          </TabsTrigger>
          <TabsTrigger value="shortlist">
            Shortlist{" "}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{shortlistCount}</span>
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
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground">
              {all.length === 0
                ? "No candidates yet."
                : "No candidates match your filters."}
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
              {pageRows.map((c) => {
                const sid = resolveStageId(c);
                const cur = sid ? stageById.get(sid) : null;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/staff/$id", params: { id: c.id } })}
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
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {cur?.label ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <FitBadge value={c.fit} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ResumeLink path={(c as any).resume_url ?? null} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Star
                        className={cn(
                          "mx-auto h-4 w-4",
                          c.shortlisted
                            ? "fill-accent stroke-accent"
                            : "stroke-muted-foreground/40",
                        )}
                      />
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
        href={linkedinUrl!}
        target="_blank"
        rel="noopener noreferrer"
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

function ResumeLink({ path }: { path: string | null }) {
  const [busy, setBusy] = useState(false);
  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  async function open(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await openResumeInNewTab(path!);
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
