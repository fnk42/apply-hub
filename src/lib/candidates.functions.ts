import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FIT_VALUES = ["unrated", "weak", "medium", "strong"] as const;
const STATUS_VALUES = [
  "sourced",
  "scheduled_interview",
  "rejected_screening",
  "candidate_declined",
] as const;

// ---- getMyRoles ----
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r) => r.role as string) };
  });

// ---- listCandidates ----
const listInput = z.object({
  search: z.string().trim().max(100).optional(),
  fit: z.enum(FIT_VALUES).optional(),
  pipeline_status: z.enum(STATUS_VALUES).optional(),
});

export const listCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("applications")
      .select(
        "id, created_at, source, full_name, email, phone, linkedin_url, current_company, years_of_experience, fit, pipeline_status",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.fit) q = q.eq("fit", data.fit);
    if (data.pipeline_status) q = q.eq("pipeline_status", data.pipeline_status);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { candidates: rows ?? [] };
  });

// ---- getCandidate ----
export const getCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [appRes, eventsRes] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.id).single(),
      supabase
        .from("application_events")
        .select("*")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (appRes.error) throw new Error(appRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    return { application: appRes.data, events: eventsRes.data ?? [] };
  });

// ---- updateCandidate ----
const updateInput = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      fit: z.enum(FIT_VALUES).optional(),
      pipeline_status: z.enum(STATUS_VALUES).optional(),
      recruiter_notes: z.string().max(10000).nullable().optional(),
      current_company: z.string().trim().max(160).nullable().optional(),
      years_of_experience: z.number().int().min(0).max(60).nullable().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "Empty patch"),
});

export const updateCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("applications")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- createCandidate (manual add) ----
const createInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  linkedin_url: z.string().trim().max(255).optional().or(z.literal("")),
  current_company: z.string().trim().max(160).optional().or(z.literal("")),
  years_of_experience: z.number().int().min(0).max(60).nullable().optional(),
  cover_note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .insert({
        source: "manual",
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        linkedin_url: data.linkedin_url || null,
        current_company: data.current_company || null,
        years_of_experience: data.years_of_experience ?? null,
        cover_note: data.cover_note || null,
        screening_answers: {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ---- getResumeSignedUrl ----
export const getResumeSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: signed, error } = await supabaseAdmin.storage
      .from("resumes")
      .createSignedUrl(data.path, 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
