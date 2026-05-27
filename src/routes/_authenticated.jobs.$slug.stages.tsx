import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteJobAdStage,
  getJobAdBySlug,
  getMyRoles,
  listJobAdStages,
  reorderJobAdStages,
  upsertJobAdStage,
} from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";

const adQuery = (slug: string) =>
  queryOptions({
    queryKey: ["job-ad", slug],
    queryFn: () => getJobAdBySlug({ data: { slug } }),
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

export const Route = createFileRoute("/_authenticated/jobs/$slug/stages")({
  loader: async ({ context, params }) => {
    const { roles } = await context.queryClient.ensureQueryData(rolesQuery);
    if (!roles.includes("admin")) {
      throw redirect({ to: "/staff/jobs/$slug", params: { slug: params.slug } });
    }
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
    await context.queryClient.ensureQueryData(stagesQuery(ad.id));
  },
  component: StagesPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Job ad not found</h1>
      <Link to="/staff/jobs" className="mt-4 inline-block text-primary hover:underline">
        Back to all ads
      </Link>
    </div>
  ),
});

function StagesPage() {
  const { slug } = Route.useParams();
  const { data: adData } = useSuspenseQuery(adQuery(slug));
  const ad = adData.ad!;
  const { data: stagesData } = useSuspenseQuery(stagesQuery(ad.id));
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const stages = stagesData.stages;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["job-ad-stages", ad.id] });
    qc.invalidateQueries({ queryKey: ["candidates"] });
  }

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      await upsertJobAdStage({ data: { job_ad_id: ad.id, label } });
      setNewLabel("");
      invalidate();
      toast.success("Stage added");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const label = editLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      await upsertJobAdStage({ data: { id, job_ad_id: ad.id, label } });
      setEditingId(null);
      invalidate();
      toast.success("Renamed");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete the "${label}" stage? Candidates in it will keep their record but lose this stage.`)) return;
    setBusy(true);
    try {
      await deleteJobAdStage({ data: { id } });
      invalidate();
      toast.success("Stage deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const order = stages.map((s) => s.id);
    [order[index], order[target]] = [order[target], order[index]];
    setBusy(true);
    try {
      await reorderJobAdStages({ data: { job_ad_id: ad.id, order } });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
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
      <h1 className="mt-3 font-serif text-3xl tracking-tight">Pipeline stages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage the stages candidates flow through for{" "}
        <span className="font-medium">{ad.title}</span>.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card">
        <ul className="divide-y divide-border">
          {stages.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">
                {i + 1}.
              </span>
              {editingId === s.id ? (
                <>
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    maxLength={60}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" disabled={busy} onClick={() => handleRename(s.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{s.label}</span>
                  {s.is_default && (
                    <span className="text-xs italic text-muted-foreground">default</span>
                  )}
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
                    disabled={busy || i === stages.length - 1}
                    onClick={() => handleMove(i, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(s.id);
                      setEditLabel(s.label);
                    }}
                    aria-label="Rename"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => handleDelete(s.id, s.label)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Input
            placeholder="New stage label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={60}
            className="h-9 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button onClick={handleAdd} disabled={busy || !newLabel.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add stage
          </Button>
        </div>
      </div>
    </div>
  );
}
