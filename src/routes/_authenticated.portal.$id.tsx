import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getCandidate,
  updateCandidate,
  getResumeSignedUrl,
} from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FitBadge,
  STATUS_LABELS,
  FIT_LABELS,
} from "@/components/portal/Badges";
import { screeningQuestions } from "@/config/screening";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Download, ExternalLink } from "lucide-react";

const candidateQuery = (id: string) =>
  queryOptions({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/portal/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(candidateQuery(params.id)),
  component: CandidateDetailPage,
});

function CandidateDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(candidateQuery(id));
  const qc = useQueryClient();
  const a = data.application;
  const [notes, setNotes] = useState<string>(a.recruiter_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function patch(p: Record<string, any>) {
    await updateCandidate({ data: { id, patch: p } });
    qc.invalidateQueries({ queryKey: ["candidate", id] });
    qc.invalidateQueries({ queryKey: ["candidates"] });
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await patch({ recruiter_notes: notes });
      toast.success("Notes saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function changeFit(v: string) {
    try {
      await patch({ fit: v });
      toast.success("Fit updated");
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  async function changeStatus(v: string) {
    try {
      await patch({ pipeline_status: v });
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  async function openResume() {
    if (!a.resume_url) return;
    try {
      const { url } = await getResumeSignedUrl({ data: { path: a.resume_url } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Could not open resume");
    }
  }

  const screening = (a.screening_answers as Record<string, any>) || {};

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link to="/portal" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to candidates
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Added {new Date(a.created_at).toLocaleString()} · source: {a.source}
          </p>
        </div>
        <FitBadge value={a.fit} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="space-y-6">
          <Card title="Contact">
            <Row label="Email">
              <a className="text-primary hover:underline" href={`mailto:${a.email}`}>
                {a.email}
              </a>
            </Row>
            {a.phone && <Row label="Phone">{a.phone}</Row>}
            {a.linkedin_url && (
              <Row label="LinkedIn">
                <LinkedInDisplay value={a.linkedin_url} />
              </Row>
            )}
            {a.resume_url && (
              <Row label="Resume">
                <Button size="sm" variant="outline" onClick={openResume}>
                  <Download className="mr-1 h-4 w-4" /> Open resume
                </Button>
              </Row>
            )}
          </Card>

          {a.cover_note && (
            <Card title="Cover note">
              <p className="whitespace-pre-wrap text-sm">{a.cover_note}</p>
            </Card>
          )}

          {Object.keys(screening).length > 0 && (
            <Card title="Screening answers">
              <dl className="space-y-4">
                {screeningQuestions.map((q) => {
                  const v = screening[q.id];
                  if (v === undefined || v === null || v === "") return null;
                  return (
                    <div key={q.id}>
                      <dt className="text-sm font-medium text-foreground">
                        {q.label}
                      </dt>
                      <dd className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {Array.isArray(v) ? v.join(", ") : String(v)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <Card title="Fit">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FIT_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => changeFit(k)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    a.fit === k
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-input hover:border-accent",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Pipeline status">
            <Select value={a.pipeline_status} onValueChange={changeStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card title="Recruiter notes">
            <Textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Free-form notes…"
            />
            <Button
              size="sm"
              className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={saveNotes}
              disabled={savingNotes || notes === (a.recruiter_notes ?? "")}
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </Card>

          <Card title="Activity log">
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {data.events.map((ev) => (
                  <li key={ev.id} className="border-l-2 border-border pl-3">
                    <div className="text-sm font-medium">
                      {formatEvent(ev.event_type, ev.from_value, ev.to_value)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ev.actor_email ?? "system"} ·{" "}
                      {new Date(ev.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function LinkedInDisplay({ value }: { value: string }) {
  const isUrl = /^https?:\/\//i.test(value);
  if (isUrl) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        Profile <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return <span>{value}</span>;
}

function formatEvent(type: string, from: string | null, to: string | null) {
  switch (type) {
    case "created":
      return "Application submitted";
    case "manual_added":
      return "Manually added";
    case "fit_changed":
      return `Fit: ${FIT_LABELS[from ?? ""] ?? from ?? "—"} → ${FIT_LABELS[to ?? ""] ?? to ?? "—"}`;
    case "status_changed":
      return `Status: ${STATUS_LABELS[from ?? ""] ?? from ?? "—"} → ${STATUS_LABELS[to ?? ""] ?? to ?? "—"}`;
    case "note_updated":
      return "Notes updated";
    default:
      return type;
  }
}
