import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createCandidate, getJobAdBySlug } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const adQuery = (slug: string) =>
  queryOptions({
    queryKey: ["job-ad", slug],
    queryFn: () => getJobAdBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/_authenticated/jobs/$slug/add-candidate")({
  loader: async ({ context, params }) => {
    const { ad } = await context.queryClient.ensureQueryData(adQuery(params.slug));
    if (!ad) throw notFound();
  },
  component: AddCandidatePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-serif text-3xl">Job ad not found</h1>
      <Link to="/staff/jobs" className="mt-4 inline-block text-primary hover:underline">
        Back to all ads
      </Link>
    </div>
  ),
});

function AddCandidatePage() {
  const { slug } = Route.useParams();
  const { data: adData } = useSuspenseQuery(adQuery(slug));
  const ad = adData.ad!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createCandidateFn = useServerFn(createCandidate);
  const [submitting, setSubmitting] = useState(false);
  const [companyNA, setCompanyNA] = useState(false);
  const [companyVal, setCompanyVal] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const yoeRaw = String(form.get("years_of_experience") || "").trim();
    const yoe = yoeRaw === "" ? null : Number(yoeRaw);
    if (yoe !== null && (!Number.isInteger(yoe) || yoe < 0 || yoe > 60)) {
      toast.error("Years of experience must be 0–60");
      return;
    }
    const orEmpty = (v: FormDataEntryValue | null) => String(v ?? "").trim();
    const companyTrimmed = companyNA ? "" : companyVal.trim();

    setSubmitting(true);
    let newId: string | null = null;
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out after 15s")), 15000),
      );
      const res = await Promise.race([
        createCandidateFn({
          data: {
            job_ad_id: ad.id,
            full_name: String(form.get("full_name") || "").trim(),
            email: String(form.get("email") || "").trim(),
            phone: orEmpty(form.get("phone")),
            linkedin_url: orEmpty(form.get("linkedin_url")),
            current_company: companyTrimmed,
            current_title: orEmpty(form.get("current_title")),
            years_of_experience: yoe,
            cover_note: orEmpty(form.get("cover_note")),
          },
        }),
        timeout,
      ]);
      newId = res.id;
    } catch (err: any) {
      console.error("createCandidate failed", err);
      const msg =
        err?.message || err?.toString?.() || "Failed to add candidate";
      toast.error(msg, { duration: 6000 });
      return;
    } finally {
      setSubmitting(false);
    }

    qc.invalidateQueries({ queryKey: ["candidates"] });
    qc.invalidateQueries({ queryKey: ["job-ad", slug] });
    toast.success("Candidate added");
    try {
      await navigate({ to: "/staff/$id", params: { id: newId! }, search: { from: ad.id } });
    } catch (err) {
      console.error("navigate to candidate failed, falling back", err);
      navigate({ to: "/staff/jobs/$slug", params: { slug } });
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
      <h1 className="mt-3 font-serif text-3xl tracking-tight">Add candidate</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manually add someone you've sourced for <span className="font-medium">{ad.title}</span>.
        Only name and email are required.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field id="full_name" label="Full name *">
          <Input id="full_name" name="full_name" required maxLength={120} />
        </Field>
        <Field id="email" label="Email *">
          <Input id="email" name="email" type="email" required maxLength={255} />
        </Field>
        <Field id="phone" label="Phone">
          <Input id="phone" name="phone" maxLength={40} />
        </Field>
        <Field id="linkedin_url" label="LinkedIn">
          <Input
            id="linkedin_url"
            name="linkedin_url"
            maxLength={255}
            placeholder="LinkedIn URL or handle"
          />
        </Field>
        <Field id="current_company" label="Current company">
          <Input
            id="current_company"
            value={companyVal}
            onChange={(e) => setCompanyVal(e.target.value)}
            maxLength={160}
            disabled={companyNA}
            placeholder={companyNA ? "Not currently employed" : ""}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={companyNA}
              onCheckedChange={(c) => setCompanyNA(c === true)}
            />
            Not currently employed / N/A
          </label>
        </Field>
        <Field id="current_title" label="Current title">
          <Input id="current_title" name="current_title" maxLength={160} />
        </Field>
        <Field id="years_of_experience" label="Years of experience">
          <Input
            id="years_of_experience"
            name="years_of_experience"
            type="number"
            min={0}
            max={60}
            inputMode="numeric"
          />
        </Field>
        <Field id="cover_note" label="Notes for the candidate record">
          <Textarea id="cover_note" name="cover_note" rows={4} maxLength={2000} />
        </Field>
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={submitting}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {submitting ? "Adding…" : "Add candidate"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/staff/jobs/$slug" params={{ slug }}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
