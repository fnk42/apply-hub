import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/config/company";
import { screeningQuestions } from "@/config/screening";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Apply — ${company.name}` },
      {
        name: "description",
        content: `Submit your application to ${company.name}.`,
      },
    ],
  }),
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
      let s = z.string().trim().max(q.max);
      shape[q.id] = q.required ? s.min(1, "Required") : s.optional();
    } else if (q.type === "single") {
      const s = z.enum(q.options as [string, ...string[]]);
      shape[q.id] = q.required
        ? s
        : s.optional();
    } else {
      const s = z.array(z.enum(q.options as [string, ...string[]]));
      shape[q.id] = q.required ? s.min(1, "Select at least one") : s;
    }
  }
  return z.object(shape);
}

function ApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [companyNA, setCompanyNA] = useState(false);
  const [companyVal, setCompanyVal] = useState("");
  const [yoeVal, setYoeVal] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const q of screeningQuestions) {
      init[q.id] = q.type === "multiselect" ? [] : "";
    }
    return init;
  });

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
    else if (resumeFile.size > MAX_RESUME)
      fieldErrors.resume = "Max 10MB";
    else if (!ALLOWED_MIME.includes(resumeFile.type))
      fieldErrors.resume = "PDF or DOCX only";

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (values.honeypot) return; // silent honeypot

    setSubmitting(true);
    try {
      // 1. Upload resume
      const ext = resumeFile!.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("resumes")
        .upload(path, resumeFile!, {
          contentType: resumeFile!.type,
          upsert: false,
        });
      if (up.error) throw up.error;

      // 2. Insert application
      const ins = await supabase.from("applications").insert({
        source: "public_form",
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        linkedin_url: values.linkedin_url,
        current_company: values.current_company || null,
        years_of_experience: values.years_of_experience,
        resume_url: up.data.path,
        cover_note: values.cover_note || null,
        screening_answers: answers,
        honeypot: "",
      });
      if (ins.error) throw ins.error;

      setDone(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
          <h1 className="mt-6 text-3xl font-semibold text-foreground">
            Application received
          </h1>
          <p className="mt-3 text-muted-foreground">
            Thanks for applying to {company.name}. We'll review your submission
            and reach out if there's a fit.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {company.tagline || "Apply"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Tell us about yourself. Fields marked with * are required.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8" noValidate>
          {/* honeypot */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <Field label="Full name *" error={errors.full_name} id="full_name">
            <Input id="full_name" name="full_name" required maxLength={120} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Email *" error={errors.email} id="email">
              <Input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
              />
            </Field>
            <Field label="Phone *" error={errors.phone} id="phone">
              <Input id="phone" name="phone" required maxLength={40} />
            </Field>
          </div>

          <Field
            label="LinkedIn URL *"
            error={errors.linkedin_url}
            id="linkedin_url"
          >
            <Input
              id="linkedin_url"
              name="linkedin_url"
              placeholder="LinkedIn URL or handle"
              required
              maxLength={255}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
            <Field
              label="Current company"
              error={errors.current_company}
              id="current_company"
            >
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
            <Field
              label="Years of experience *"
              error={errors.years_of_experience}
              id="years_of_experience"
            >
              <Input
                id="years_of_experience"
                name="years_of_experience"
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={yoeVal}
                onChange={(e) => setYoeVal(e.target.value)}
                required
              />
            </Field>
          </div>


          <Field label="Resume (PDF or DOCX, max 10MB) *" error={errors.resume} id="resume">
            <label
              htmlFor="resume"
              className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-input px-4 py-6 transition-colors hover:border-accent hover:bg-accent/10"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {resumeFile ? resumeFile.name : "Click to upload your resume"}
              </span>
              <input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) =>
                  setResumeFile(e.target.files?.[0] || null)
                }
              />
            </label>
          </Field>

          <Field
            label="Short cover note (optional, 500 chars)"
            error={errors.cover_note}
            id="cover_note"
          >
            <Textarea
              id="cover_note"
              name="cover_note"
              maxLength={500}
              rows={4}
            />
          </Field>

          <div className="space-y-8 border-t border-border pt-8">
            <h2 className="text-xl font-semibold text-foreground">
              Screening questions
            </h2>

            {screeningQuestions.map((q) => {
              const errKey = `screening.${q.id}`;
              const err = errors[errKey];
              return (
                <div key={q.id} className="space-y-2">
                  <Label className="text-base font-medium leading-snug">
                    {q.label} {q.required && <span className="text-accent">*</span>}
                  </Label>

                  {q.type === "text" && (
                    <>
                      <Textarea
                        value={answers[q.id] || ""}
                        maxLength={q.max}
                        rows={3}
                        onChange={(e) =>
                          setAnswers({ ...answers, [q.id]: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {(answers[q.id] || "").length} / {q.max}
                      </p>
                    </>
                  )}

                  {q.type === "single" && (
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={(v) =>
                        setAnswers({ ...answers, [q.id]: v })
                      }
                      className="gap-2"
                    >
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2 hover:bg-accent/10"
                        >
                          <RadioGroupItem value={opt} />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  )}

                  {q.type === "multiselect" && (
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const checked = (answers[q.id] as string[]).includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2 hover:bg-accent/10"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                const cur = answers[q.id] as string[];
                                setAnswers({
                                  ...answers,
                                  [q.id]: c
                                    ? [...cur, opt]
                                    : cur.filter((x) => x !== opt),
                                });
                              }}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {err && <p className="text-sm text-destructive">{err}</p>}
                </div>
              );
            })}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Header() {
  const initials = company.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-5">
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-9 w-9 rounded"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded bg-accent font-semibold text-accent-foreground">
            {initials}
          </div>
        )}
        <span className="text-lg font-semibold">{company.name}</span>
      </div>
    </header>
  );
}

function Field({
  label,
  error,
  id,
  children,
}: {
  label: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
