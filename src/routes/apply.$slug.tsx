import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicJobAd, submitApplication } from "@/lib/candidates.functions";
import { company } from "@/config/company";
import { screeningQuestions } from "@/config/screening";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Upload } from "lucide-react";

const adQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-job-ad", slug],
    queryFn: () => getPublicJobAd({ data: { slug } }),
  });

export const Route = createFileRoute("/apply/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(adQuery(params.slug)),
  head: ({ loaderData }) => {
    const title = loaderData?.ad?.title
      ? `Apply: ${loaderData.ad.title} — ${company.name}`
      : `Apply — ${company.name}`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Submit your application to ${company.name}.`,
        },
        { property: "og:title", content: title },
      ],
    };
  },
  component: ApplyPage,
});

const MAX_RESUME = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const baseSchema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(5, "Required").max(40),
  linkedin_url: z.string().trim().min(1, "Required").max(255),
  current_company: z.string().trim().max(160).optional().or(z.literal("")),
  years_of_experience: z
    .number()
    .int()
    .min(0, "Must be 0 or more")
    .max(60, "Must be 60 or less"),
  cover_note: z.string().trim().max(500).optional().or(z.literal("")),
  honeypot: z.string().max(0).optional().or(z.literal("")),
});

function buildScreeningSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of screeningQuestions) {
    if (q.type === "text") {
      const s = z.string().trim().max(q.max);
      shape[q.id] = q.required ? s.min(1, "Required") : s.optional();
    } else if (q.type === "single") {
      const s = z.enum(q.options as [string, ...string[]]);
      shape[q.id] = q.required ? s : s.optional();
    } else {
      const s = z.array(z.enum(q.options as [string, ...string[]]));
      shape[q.id] = q.required ? s.min(1, "Select at least one") : s;
    }
  }
  return z.object(shape);
}

function ApplyPage() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { data } = useSuspenseQuery(adQuery(slug));
  const ad = data.ad;
  const clientName = data.client_name;

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [companyNA, setCompanyNA] = useState(false);
  const [companyVal, setCompanyVal] = useState("");
  const [yoeVal, setYoeVal] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const q of screeningQuestions) {
      init[q.id] = q.type === "multiselect" ? [] : "";
    }
    return init;
  });

  if (!ad) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Role not found</h1>
        <p className="mt-3 text-muted-foreground">
          This link may be out of date. Browse all open roles below.
        </p>
        <Button asChild className="mt-6">
          <a href="/">View open roles</a>
        </Button>
      </div>
    );
  }

  if (ad.status !== "live") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">{ad.title}</h1>
        {clientName && (
          <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
        )}
        <p className="mt-6 text-muted-foreground">
          This role is no longer accepting applications.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/">See other open roles</a>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const yoeNum = yoeVal.trim() === "" ? NaN : Number(yoeVal);
    const values = {
      full_name: String(form.get("full_name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      linkedin_url: String(form.get("linkedin_url") || ""),
      current_company: companyNA ? "" : companyVal.trim(),
      years_of_experience: yoeNum,
      cover_note: String(form.get("cover_note") || ""),
      honeypot: String(form.get("website") || ""),
    };

    const base = baseSchema.safeParse(values);
    const scr = buildScreeningSchema().safeParse(answers);

    const fieldErrors: Record<string, string> = {};
    if (!base.success) {
      for (const issue of base.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
    }
    if (!scr.success) {
      for (const issue of scr.error.issues) {
        fieldErrors[`screening.${issue.path.join(".")}`] = issue.message;
      }
    }
    if (!resumeFile) fieldErrors.resume = "Resume is required";
    else if (resumeFile.size > MAX_RESUME) fieldErrors.resume = "Max 10MB";
    else if (!ALLOWED_MIME.includes(resumeFile.type))
      fieldErrors.resume = "PDF or DOCX only";

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (values.honeypot) return;

    setSubmitting(true);
    try {
      const ext = resumeFile!.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("resumes")
        .upload(path, resumeFile!, {
          contentType: resumeFile!.type,
          upsert: false,
        });
      if (up.error) throw up.error;

      await submitApplication({
        data: {
          job_ad_id: ad!.id,
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          linkedin_url: values.linkedin_url,
          current_company: values.current_company,
          years_of_experience: values.years_of_experience,
          cover_note: values.cover_note,
          resume_path: up.data.path,
          screening_answers: answers,
          honeypot: "",
        },
      });

      setDone(true);
      router.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-4 font-serif text-4xl">Application received</h1>
        <p className="mt-3 text-muted-foreground">
          Thanks for applying to {ad.title}
          {clientName ? ` at ${clientName}` : ""}. We&apos;ll review and be in
          touch if there&apos;s a fit.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {clientName ?? company.name}
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{ad.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply below. Fields marked * are required.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />

        <Field label="Full name *" error={errors.full_name}>
          <Input name="full_name" required maxLength={120} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Email *" error={errors.email}>
            <Input type="email" name="email" required maxLength={255} />
          </Field>
          <Field label="Phone *" error={errors.phone}>
            <Input name="phone" required maxLength={40} />
          </Field>
        </div>

        <Field label="LinkedIn URL *" error={errors.linkedin_url}>
          <Input
            name="linkedin_url"
            required
            maxLength={255}
            placeholder="https://linkedin.com/in/..."
          />
        </Field>

        <Field label="Current company" error={errors.current_company}>
          <Input
            value={companyVal}
            onChange={(e) => setCompanyVal(e.target.value)}
            disabled={companyNA}
            maxLength={160}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={companyNA}
              onCheckedChange={(v) => setCompanyNA(!!v)}
            />
            Not currently employed
          </label>
        </Field>

        <Field
          label="Years of experience *"
          error={errors.years_of_experience}
        >
          <Input
            type="number"
            min={0}
            max={60}
            value={yoeVal}
            onChange={(e) => setYoeVal(e.target.value)}
            required
          />
        </Field>

        <Field label="Resume (PDF or DOCX, max 10MB) *" error={errors.resume}>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-4 py-3 hover:bg-muted/40">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {resumeFile?.name ?? "Choose a file…"}
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <Field label="Cover note (optional)" error={errors.cover_note}>
          <Textarea name="cover_note" rows={4} maxLength={500} />
        </Field>

        {screeningQuestions.length > 0 && (
          <div className="space-y-6 border-t border-border pt-6">
            <h2 className="font-serif text-2xl tracking-tight">
              A few quick questions
            </h2>
            {screeningQuestions.map((q) => {
              const errKey = `screening.${q.id}`;
              if (q.type === "text") {
                return (
                  <Field
                    key={q.id}
                    label={`${q.label}${q.required ? " *" : ""}`}
                    error={errors[errKey]}
                  >
                    <Textarea
                      rows={3}
                      maxLength={q.max}
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                    />
                  </Field>
                );
              }
              if (q.type === "single") {
                return (
                  <Field
                    key={q.id}
                    label={`${q.label}${q.required ? " *" : ""}`}
                    error={errors[errKey]}
                  >
                    <RadioGroup
                      value={String(answers[q.id] ?? "")}
                      onValueChange={(v) =>
                        setAnswers((a) => ({ ...a, [q.id]: v }))
                      }
                    >
                      {q.options.map((opt) => (
                        <div key={opt} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={opt}
                            id={`${q.id}-${opt}`}
                          />
                          <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </Field>
                );
              }
              const arr = (answers[q.id] as string[]) ?? [];
              return (
                <Field
                  key={q.id}
                  label={`${q.label}${q.required ? " *" : ""}`}
                  error={errors[errKey]}
                >
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const checked = arr.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setAnswers((a) => {
                                const cur = ((a[q.id] as string[]) ?? []).filter(
                                  (x) => x !== opt,
                                );
                                if (v) cur.push(opt);
                                return { ...a, [q.id]: cur };
                              });
                            }}
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              );
            })}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
