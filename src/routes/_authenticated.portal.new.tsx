import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createCandidate } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/new")({
  component: NewCandidatePage,
});

function NewCandidatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
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
    setSubmitting(true);
    try {
      const { id } = await createCandidate({
        data: {
          full_name: String(form.get("full_name") || "").trim(),
          email: String(form.get("email") || "").trim(),
          phone: String(form.get("phone") || "").trim(),
          linkedin_url: String(form.get("linkedin_url") || "").trim(),
          current_company: companyNA ? "" : companyVal.trim(),
          years_of_experience: yoe,
          cover_note: String(form.get("cover_note") || "").trim(),
        },
      });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidate added");
      navigate({ to: "/portal/$id", params: { id } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add candidate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link to="/portal/candidates" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to candidates
      </Link>
      <h1 className="mt-3 font-serif text-3xl tracking-tight">Add candidate</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manually add someone you've sourced. Only name and email are required.
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
            <Link to="/portal/candidates">Cancel</Link>
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
