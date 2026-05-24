import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyRoles, listClients } from "@/lib/candidates.functions";
import { getAppSettings } from "@/lib/admin.functions";
import { createJobAd } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const clientsQ = queryOptions({
  queryKey: ["clients"],
  queryFn: () => listClients(),
});

const settingsQ = queryOptions({
  queryKey: ["admin-settings"],
  queryFn: () => getAppSettings(),
});

export const Route = createFileRoute("/_authenticated/portal/jobs/new")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/portal/jobs" });
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(clientsQ),
      context.queryClient.ensureQueryData(settingsQ),
    ]);
  },
  component: NewJobAdPage,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function NewJobAdPage() {
  const { data: clientsData } = useSuspenseQuery(clientsQ);
  const { data: settingsData } = useSuspenseQuery(settingsQ);
  const navigate = useNavigate();

  const defaultFeeDollars = useMemo(() => {
    const cents = settingsData?.defaultPostingFeeCents;
    if (typeof cents === "number" && cents > 0) return String(Math.round(cents / 100));
    return "";
  }, [settingsData]);

  const [clientId, setClientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [rolesCount, setRolesCount] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [feeDollars, setFeeDollars] = useState(defaultFeeDollars);
  const [status, setStatus] = useState<"pending_authorization" | "live" | "draft">(
    "pending_authorization",
  );
  const [submitting, setSubmitting] = useState(false);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Pick a client");
      return;
    }
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    const rolesNum = Number(rolesCount);
    if (!Number.isFinite(rolesNum) || rolesNum < 1) {
      toast.error("Roles count must be at least 1");
      return;
    }
    let feeCents: number | null = null;
    if (isBillable && feeDollars.trim() !== "") {
      const dollars = Number(feeDollars);
      if (!Number.isFinite(dollars) || dollars < 0) {
        toast.error("Posting fee must be a number");
        return;
      }
      feeCents = Math.round(dollars * 100);
    }

    setSubmitting(true);
    try {
      const res = await createJobAd({
        data: {
          client_id: clientId,
          title: title.trim(),
          slug: slug.trim() || undefined,
          jd_text: jdText.trim() || undefined,
          jd_url: jdUrl.trim() || undefined,
          linkedin_job_url: linkedinUrl.trim() || undefined,
          roles_count: rolesNum,
          start_date: startDate || undefined,
          is_billable: isBillable,
          posting_fee_cents: feeCents,
          status,
        },
      });
      toast.success("Job ad created");
      navigate({ to: "/portal/jobs/$slug", params: { slug: res.slug } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create job ad");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/portal/jobs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to job ads
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">New job ad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One job ad can cover multiple roles for the same client.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="client">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clientsData.clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Business Manager"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="business-manager"
          />
          <p className="text-xs text-muted-foreground">
            Used in the public apply URL. Auto-derived from the title — edit to override.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd_text">JD text</Label>
          <Textarea
            id="jd_text"
            rows={8}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="jd_url">JD URL (optional)</Label>
            <Input
              id="jd_url"
              type="url"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn job URL (optional)</Label>
            <Input
              id="linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/…"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="roles_count">Roles count</Label>
            <Input
              id="roles_count"
              type="number"
              min={1}
              max={50}
              value={rolesCount}
              onChange={(e) => setRolesCount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              e.g. Business Manager with 3 openings → 3.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_date">Start date (optional)</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="billable" className="text-base">
                Billable
              </Label>
              <p className="text-xs text-muted-foreground">
                Charge the client a posting fee when the ad reaches 10 candidates.
              </p>
            </div>
            <Switch id="billable" checked={isBillable} onCheckedChange={setIsBillable} />
          </div>
          {isBillable && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="fee">Posting fee (USD)</Label>
              <Input
                id="fee"
                type="number"
                min={0}
                step={1}
                value={feeDollars}
                onChange={(e) => setFeeDollars(e.target.value)}
                placeholder="35000"
              />
              <p className="text-xs text-muted-foreground">
                Stored in cents. Leave empty to use the workspace default.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Initial status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_authorization">Pending authorization</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="live">Live (accept applications now)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create job ad"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/portal/jobs" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
