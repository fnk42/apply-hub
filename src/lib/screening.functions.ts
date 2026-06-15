import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ScreeningQuestion } from "@/config/screening";

// ---------------------------------------------------------------------------
// Per-ad screening questions. Backs the public apply form (getQuestionsForJobAd)
// and the admin authoring UI (upsert/delete/reorder). Mirrors the job_ad_stages
// CRUD in candidates.functions.ts.
// ---------------------------------------------------------------------------

const QUESTION_TYPES = ["text", "textarea", "single", "multiselect"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

type QuestionRow = {
  id: string;
  key: string;
  type: string;
  label: string;
  options: unknown;
  required: boolean;
  max: number | null;
  position: number;
};

// Map a DB row -> the renderer's ScreeningQuestion shape (untouched by this
// feature). The renderer keys answers by question.id, so we expose the stable
// `key`, NOT the uuid PK. DB `textarea` collapses to renderer `text` because the
// existing renderer already renders `text` as a multi-line <Textarea>.
function rowToQuestion(r: QuestionRow): ScreeningQuestion {
  const options = Array.isArray(r.options) ? (r.options as string[]) : [];
  if (r.type === "single") {
    return { id: r.key, type: "single", label: r.label, required: r.required, options };
  }
  if (r.type === "multiselect") {
    return { id: r.key, type: "multiselect", label: r.label, required: r.required, options };
  }
  // "text" and "textarea" both render as the existing textarea question.
  return { id: r.key, type: "text", label: r.label, required: r.required, max: r.max ?? 300 };
}

function slugifyKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "question";
}

// ---- getQuestionsForJobAd (PUBLIC) ----
// Uses supabaseAdmin like getPublicJobAd (the apply form is anonymous). Returns
// ScreeningQuestion[] ordered by position.
export const getQuestionsForJobAd = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ job_ad_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<ScreeningQuestion[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("screening_questions")
      .select("id, key, type, label, options, required, max, position")
      .eq("job_ad_id", data.job_ad_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToQuestion);
  });

// ---- listScreeningQuestions (admin/recruiter, raw rows for authoring) ----
export const listScreeningQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ job_ad_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("screening_questions")
      .select("id, key, type, label, options, required, max, position")
      .eq("job_ad_id", data.job_ad_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const questions = (rows ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      type: r.type as QuestionType,
      label: r.label,
      options: Array.isArray(r.options) ? (r.options as string[]) : [],
      required: r.required,
      max: r.max,
      position: r.position,
    }));
    return { questions };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertWriter(supabase: any, userId: string) {
  const { data: roleRows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "member"]);
  if (error) throw new Error(error.message);
  if (!(roleRows ?? []).length) {
    throw new Error("Only admins and members can manage screening questions.");
  }
}

// ---- upsertScreeningQuestion (admin/recruiter) ----
const upsertInput = z.object({
  id: z.string().uuid().optional(),
  job_ad_id: z.string().uuid(),
  type: z.enum(QUESTION_TYPES),
  label: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  required: z.boolean().default(true),
  max: z.number().int().min(1).max(5000).nullable().optional(),
  position: z.number().int().min(1).max(200).optional(),
});

export const upsertScreeningQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => upsertInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertWriter(supabase, userId);

    const choiceType = data.type === "single" || data.type === "multiselect";
    const options = choiceType ? data.options : [];
    const max = data.type === "text" || data.type === "textarea" ? (data.max ?? 300) : null;

    if (data.id) {
      // Edit: never change key or job_ad_id (would orphan collected answers).
      const patch: Record<string, unknown> = {
        type: data.type,
        label: data.label,
        options,
        required: data.required,
        max,
      };
      if (data.position !== undefined) patch.position = data.position;
      const { error } = await supabase
        .from("screening_questions")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Insert: append at end, generate a stable unique key within this ad.
    const { data: existing } = await supabase
      .from("screening_questions")
      .select("key, position")
      .eq("job_ad_id", data.job_ad_id);
    const usedKeys = new Set((existing ?? []).map((r: { key: string }) => r.key));
    const maxPos = (existing ?? []).reduce(
      (m: number, r: { position: number }) => Math.max(m, r.position),
      0,
    );

    const base = slugifyKey(data.label);
    let key = base;
    let n = 2;
    while (usedKeys.has(key)) key = `${base}_${n++}`;

    const { error } = await supabase.from("screening_questions").insert({
      job_ad_id: data.job_ad_id,
      position: data.position ?? maxPos + 1,
      key,
      type: data.type,
      label: data.label,
      options,
      required: data.required,
      max,
    });
    if (error) throw new Error(error.message);
    return { ok: true, key };
  });

// ---- deleteScreeningQuestion (admin/recruiter) ----
export const deleteScreeningQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertWriter(supabase, userId);
    const { error } = await supabase.from("screening_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- reorderScreeningQuestions (admin/recruiter) ----
// Two-pass swap via temporary negative positions to avoid colliding on the
// unique (job_ad_id, position) ordering (mirrors reorderJobAdStages).
export const reorderScreeningQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        job_ad_id: z.string().uuid(),
        order: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertWriter(supabase, userId);
    for (let i = 0; i < data.order.length; i++) {
      const { error } = await supabase
        .from("screening_questions")
        .update({ position: -(i + 1) })
        .eq("id", data.order[i])
        .eq("job_ad_id", data.job_ad_id);
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < data.order.length; i++) {
      const { error } = await supabase
        .from("screening_questions")
        .update({ position: i + 1 })
        .eq("id", data.order[i])
        .eq("job_ad_id", data.job_ad_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
