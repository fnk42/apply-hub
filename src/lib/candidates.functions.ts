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
  source: z.enum(["inbound", "sourced"]).optional(),
  shortlisted: z.boolean().optional(),
  job_ad_id: z.string().min(1).max(64).optional(),
});

export const listCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("applications")
      .select(
        "id, created_at, source, full_name, email, phone, linkedin_url, current_company, current_title, years_of_experience, fit, pipeline_status, shortlisted, job_ad_id",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.job_ad_id) q = q.eq("job_ad_id", data.job_ad_id);
    if (data.fit) q = q.eq("fit", data.fit);
    if (data.pipeline_status) q = q.eq("pipeline_status", data.pipeline_status);
    if (data.source === "inbound") q = q.eq("source", "public_form");
    if (data.source === "sourced") q = q.eq("source", "manual");
    if (data.shortlisted !== undefined) q = q.eq("shortlisted", data.shortlisted);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { candidates: rows ?? [] };
  });

// ---- getPortalShell (sidebar data: app_name + job_ads grouped) ----
export const getPortalShell = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [adsRes, settingsRes, countsRes] = await Promise.all([
      supabase
        .from("job_ads")
        .select("id, slug, title, status")
        .order("created_at", { ascending: false }),
      supabase.from("app_settings").select("key, value").eq("key", "app_name").maybeSingle(),
      supabase.from("applications").select("job_ad_id"),
    ]);
    if (adsRes.error) throw new Error(adsRes.error.message);
    const counts = new Map<string, number>();
    for (const row of countsRes.data ?? []) {
      counts.set(row.job_ad_id, (counts.get(row.job_ad_id) ?? 0) + 1);
    }
    const ads = (adsRes.data ?? []).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      count: counts.get(a.id) ?? 0,
    }));
    const appName =
      (settingsRes.data?.value as any)?.name ??
      (typeof settingsRes.data?.value === "string" ? settingsRes.data.value : null) ??
      "Project Dashboard";
    return { appName, ads };
  });

// ---- getJobAdBySlug ----
export const getJobAdBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: ad, error } = await supabase
      .from("job_ads")
      .select(
        "id, slug, title, status, roles_count, start_date, linkedin_job_url, jd_url, jd_text, client_id, authorized_at, closed_at, created_at",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ad) return { ad: null, client: null, stats: null };

    const [clientRes, appsRes] = await Promise.all([
      supabase.from("clients").select("id, name").eq("id", ad.client_id).maybeSingle(),
      supabase
        .from("applications")
        .select("id, shortlisted")
        .eq("job_ad_id", ad.id),
    ]);

    const apps = appsRes.data ?? [];
    const stats = {
      app_count: apps.length,
      shortlist_count: apps.filter((a) => a.shortlisted).length,
    };
    return { ad, client: clientRes.data ?? null, stats };
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
      current_title: z.string().trim().max(160).nullable().optional(),
      years_of_experience: z.number().int().min(0).max(60).nullable().optional(),
      shortlisted: z.boolean().optional(),
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
  current_title: z.string().trim().max(160).optional().or(z.literal("")),
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
        job_ad_id: "00000000-0000-0000-0000-000000000010",
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        linkedin_url: data.linkedin_url || null,
        current_company: data.current_company || null,
        current_title: data.current_title || null,
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

// ---- getDashboardStats ----
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { data: all, error } = await supabase
      .from("applications")
      .select("id, source, pipeline_status, fit, shortlisted, created_at, full_name")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = all ?? [];
    const inThisWeek = (d: string) => new Date(d) >= oneWeekAgo;
    const inLastWeek = (d: string) => {
      const t = new Date(d);
      return t >= twoWeeksAgo && t < oneWeekAgo;
    };

    const count = (pred: (r: typeof rows[number]) => boolean) =>
      rows.filter(pred).length;

    const stats = {
      inbound_this_week: count((r) => r.source === "public_form" && inThisWeek(r.created_at)),
      inbound_last_week: count((r) => r.source === "public_form" && inLastWeek(r.created_at)),
      sourced_this_week: count((r) => r.source === "manual" && inThisWeek(r.created_at)),
      sourced_last_week: count((r) => r.source === "manual" && inLastWeek(r.created_at)),
      scheduled_total: count((r) => r.pipeline_status === "scheduled_interview"),
      rejected_total: count((r) => r.pipeline_status === "rejected_screening"),
      declined_total: count((r) => r.pipeline_status === "candidate_declined"),
      shortlisted_total: count((r) => r.shortlisted === true),
      total: rows.length,
    };

    // Pipeline funnel: counts per status
    const funnel = [
      { key: "sourced", label: "Sourced", count: count((r) => r.pipeline_status === "sourced") },
      { key: "scheduled_interview", label: "Scheduled for Interview", count: stats.scheduled_total },
      { key: "rejected_screening", label: "Rejected at Screening", count: stats.rejected_total },
      { key: "candidate_declined", label: "Candidate Declined", count: stats.declined_total },
    ];

    // Recent activity
    const { data: events, error: evErr } = await supabase
      .from("application_events")
      .select("id, application_id, created_at, actor_email, event_type, from_value, to_value")
      .order("created_at", { ascending: false })
      .limit(10);
    if (evErr) throw new Error(evErr.message);

    const nameById = new Map(rows.map((r) => [r.id, r.full_name]));
    const recent = (events ?? []).map((ev) => ({
      ...ev,
      candidate_name: nameById.get(ev.application_id) ?? "Unknown",
    }));

    return { stats, funnel, recent };
  });

// ---- listActivity ----
const activityInput = z.object({
  event_type: z.string().max(40).optional(),
  actor_email: z.string().max(255).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => activityInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("application_events")
      .select("id, application_id, created_at, actor_email, event_type, from_value, to_value")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    if (data.actor_email) q = q.eq("actor_email", data.actor_email);
    if (data.from_date) q = q.gte("created_at", data.from_date);
    if (data.to_date) q = q.lte("created_at", data.to_date);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);

    // get candidate names
    const appIds = Array.from(new Set((events ?? []).map((e) => e.application_id)));
    let names = new Map<string, string>();
    if (appIds.length) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id, full_name")
        .in("id", appIds);
      names = new Map((apps ?? []).map((a) => [a.id, a.full_name]));
    }

    // Distinct actors for filter dropdown
    const { data: actorRows } = await supabase
      .from("application_events")
      .select("actor_email")
      .not("actor_email", "is", null)
      .limit(1000);
    const actors = Array.from(
      new Set((actorRows ?? []).map((r) => r.actor_email).filter(Boolean) as string[]),
    ).sort();

    return {
      events: (events ?? []).map((e) => ({
        ...e,
        candidate_name: names.get(e.application_id) ?? "Unknown",
      })),
      actors,
    };
  });
