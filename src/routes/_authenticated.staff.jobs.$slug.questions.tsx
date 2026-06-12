import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getJobAdBySlug, getMyRoles } from "@/lib/candidates.functions";
import {
  deleteScreeningQuestion,
  listScreeningQuestions,
  reorderScreeningQuestions,
  upsertScreeningQuestion,
} from "@/lib/screening.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const QUESTION_TYPES = ["text", "textarea", "single", "multiselect"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Short text",
  textarea: "Long text",
  single: "Single choice",
  multiselect: "Multi-select",
};

const adQuery = (slug: string) =>
  queryOptions({
    queryKey: ["job-ad", slug],
    queryFn: () => getJobAdBySlug({ data: { slug } }),
  });

const questionsQuery = (jobAdId: string) =>
  queryOptions({
    queryKey: ["screening-questions-admin", jobAdId],
    queryFn: () => listScreeningQuestions({ data: { job_ad_id: jobAdId } }),
  });

const rolesQuery = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
});

export const Route = createFileRoute("/_authenticated/staff/jobs/$slug/questions")({
  loader: async ({ context, params }) => {
    const { roles } = await context.queryClient.ensureQueryData(rolesQuery);
    if (!roles.includes("admin") && !roles.includes("recruiter")) {
      throw redirect({ to: "/staff/jobs/$slug", params: { slug: params.slug } });
    }
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
    await context.queryClient.ensureQueryData(questionsQuery(ad.id));
  },
  component: QuestionsPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Job ad not found</h1>
      <Link to="/staff/jobs" className="mt-4 inline-block text-primary hover:underline">
        Back to all ads
      </Link>
    </div>
  ),
});

type Draft = {
  id?: string;
  type: QuestionType;
  label: string;
  options: string[];
  required: boolean;
  max: string;
};

function blankDraft(): Draft {
  return { type: "text", label: "", options: [""], required: true, max: "300" };
}

function QuestionsPage() {
  const { slug } = Route.useParams();
  const { data: adData } = useSuspenseQuery(adQuery(slug));
  const ad = adData.ad!;
  const { data: questionsData } = useSuspenseQuery(questionsQuery(ad.id));
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = questionsData.questions;
  const isChoice = draft?.type === "single" || draft?.type === "multiselect";
  const isText = draft?.type === "text" || draft?.type === "textarea";

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["screening-questions-admin", ad.id] });
    qc.invalidateQueries({ queryKey: ["screening-questions", ad.id] });
  }

  function openEdit(q: (typeof questions)[number]) {
    setDraft({
      id: q.id,
      type: q.type,
      label: q.label,
      options: q.options.length ? [...q.options] : [""],
      required: q.required,
      max: q.max != null ? String(q.max) : "300",
    });
  }

  async function handleSave() {
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      toast.error("Label is required");
      return;
    }
    const options =
      draft.type === "single" || draft.type === "multiselect"
        ? draft.options.map((o) => o.trim()).filter(Boolean)
        : [];
    if ((draft.type === "single" || draft.type === "multiselect") && options.length < 2) {
      toast.error("Add at least two options");
      return;
    }
    const max =
      draft.type === "text" || draft.type === "textarea"
        ? Math.max(1, Number(draft.max) || 300)
        : null;

    setBusy(true);
    try {
      await upsertScreeningQuestion({
        data: {
          id: draft.id,
          job_ad_id: ad.id,
          type: draft.type,
          label,
          options,
          required: draft.required,
          max,
        },
      });
      setDraft(null);
      invalidate();
      toast.success(draft.id ? "Question updated" : "Question added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (
      !confirm(
        `Delete "${label}"? Existing applicants' answers to it stay in the record but lose this label.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteScreeningQuestion({ data: { id } });
      invalidate();
      toast.success("Question deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const order = questions.map((q) => q.id);
    [order[index], order[target]] = [order[target], order[index]];
    setBusy(true);
    try {
      await reorderScreeningQuestions({ data: { job_ad_id: ad.id, order } });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        to="/staff/jobs/$slug"
        params={{ slug }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to {ad.title}
      </Link>
      <h1 className="mt-3 font-serif text-3xl tracking-tight">Screening questions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Questions shown on the public apply form for <span className="font-medium">{ad.title}</span>
        . Reordering changes the order applicants see.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card">
        {questions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No screening questions yet. Applicants only fill in the standard fields.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 w-6 text-right text-sm tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm">{q.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {TYPE_LABEL[q.type]}
                    {q.required ? " · required" : " · optional"}
                    {(q.type === "single" || q.type === "multiselect") &&
                      ` · ${q.options.length} options`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || i === 0}
                  onClick={() => handleMove(i, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy || i === questions.length - 1}
                  onClick={() => handleMove(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => openEdit(q)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => handleDelete(q.id, q.label)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!draft && (
          <div className="border-t border-border px-4 py-3">
            <Button onClick={() => setDraft(blankDraft())} disabled={busy}>
              <Plus className="mr-1 h-4 w-4" /> Add question
            </Button>
          </div>
        )}
      </div>

      {draft && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{draft.id ? "Edit question" : "New question"}</h2>
            <Button size="icon" variant="ghost" onClick={() => setDraft(null)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Type</Label>
              <Select
                value={draft.type}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, type: v as QuestionType } : d))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-sm font-medium">Label</Label>
              <Textarea
                rows={2}
                maxLength={500}
                value={draft.label}
                onChange={(e) => setDraft((d) => (d ? { ...d, label: e.target.value } : d))}
                placeholder="The question applicants see"
              />
            </div>

            {isText && (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Max characters</Label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={draft.max}
                  onChange={(e) => setDraft((d) => (d ? { ...d, max: e.target.value } : d))}
                  className="w-40"
                />
              </div>
            )}

            {isChoice && (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Options</Label>
                <div className="space-y-2">
                  {draft.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        maxLength={200}
                        onChange={(e) =>
                          setDraft((d) => {
                            if (!d) return d;
                            const options = [...d.options];
                            options[idx] = e.target.value;
                            return { ...d, options };
                          })
                        }
                        placeholder={`Option ${idx + 1}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  options: d.options.filter((_, i) => i !== idx),
                                }
                              : d,
                          )
                        }
                        aria-label="Remove option"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft((d) => (d ? { ...d, options: [...d.options, ""] } : d))}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add option
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="q-required"
                checked={draft.required}
                onCheckedChange={(v) => setDraft((d) => (d ? { ...d, required: v } : d))}
              />
              <Label htmlFor="q-required" className="text-sm">
                Required
              </Label>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={handleSave} disabled={busy}>
              {draft.id ? "Save changes" : "Add question"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
