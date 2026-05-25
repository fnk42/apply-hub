import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---- listLiveJobAds (PUBLIC) ----
export const listLiveJobAds = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("job_ads")
      .select("id, slug, title, start_date, client_id")
      .eq("status", "live")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const clientIds = Array.from(new Set((data ?? []).map((a) => a.client_id)));
    let nameById = new Map<string, string>();
    if (clientIds.length) {
      const { data: cs } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      nameById = new Map((cs ?? []).map((c) => [c.id, c.name]));
    }
    return {
      ads: (data ?? []).map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        start_date: a.start_date,
        client_name: nameById.get(a.client_id) ?? null,
      })),
    };
  },
);

// ---- getPublicJobAd (PUBLIC, by slug, only if live) ----
export const getPublicJobAd = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: ad, error } = await supabaseAdmin
      .from("job_ads")
      .select("id, slug, title, status, start_date, jd_url, client_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ad) return { ad: null, client_name: null };
    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("name")
      .eq("id", ad.client_id)
      .maybeSingle();
    return { ad, client_name: c?.name ?? null };
  });

// ---- submitApplication (PUBLIC) ----
const submitInput = z.object({
  job_ad_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID"),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(3).max(40),
  linkedin_url: z.string().trim().min(1).max(255),
  current_company: z.string().trim().max(160).optional().or(z.literal("")),
  years_of_experience: z.number().int().min(0).max(60),
  cover_note: z.string().trim().max(2000).optional().or(z.literal("")),
  resume_path: z.string().trim().min(1).max(500),
  screening_answers: z.record(z.string(), z.any()).default({}),
  honeypot: z.string().max(0).optional().or(z.literal("")),
});

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitInput.parse(data))
  .handler(async ({ data }) => {
    if (data.honeypot) return { ok: true }; // silent
    // Verify job ad is live
    const { data: ad, error: adErr } = await supabaseAdmin
      .from("job_ads")
      .select("id, status")
      .eq("id", data.job_ad_id)
      .maybeSingle();
    if (adErr) throw new Error(adErr.message);
    if (!ad || ad.status !== "live") {
      throw new Error("This role is no longer accepting applications.");
    }
    const { data: firstStage } = await supabaseAdmin
      .from("job_ad_stages")
      .select("id, legacy_status")
      .eq("job_ad_id", ad.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("applications").insert({
      source: "public_form",
      job_ad_id: ad.id,
      stage_id: firstStage?.id ?? null,
      pipeline_status: firstStage?.legacy_status ?? "sourced",
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      linkedin_url: data.linkedin_url,
      current_company: data.current_company || null,
      years_of_experience: data.years_of_experience,
      resume_url: data.resume_path,
      cover_note: data.cover_note || null,
      screening_answers: data.screening_answers ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- uploadPublicResume (PUBLIC) ----
// Proxies the resume upload through our own origin so applicants on
// networks/devices that block *.supabase.co (ad blockers, mobile carriers,
// privacy browsers) can still apply.
const ALLOWED_RESUME_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const uploadResumeInput = z.object({
  job_ad_id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Invalid UUID",
    ),
  filename: z.string().trim().min(1).max(200),
  content_type: z.enum(ALLOWED_RESUME_MIME),
  size: z.number().int().positive().max(MAX_RESUME_BYTES),
  data_base64: z.string().min(1).max(20 * 1024 * 1024), // ~14MB b64 of a 10MB file
});

export const uploadPublicResume = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadResumeInput.parse(data))
  .handler(async ({ data }) => {
    // Re-verify the ad is live before accepting bytes.
    const { data: ad, error: adErr } = await supabaseAdmin
      .from("job_ads")
      .select("id, status")
      .eq("id", data.job_ad_id)
      .maybeSingle();
    if (adErr) throw new Error(adErr.message);
    if (!ad || ad.status !== "live") {
      throw new Error("This role is no longer accepting applications.");
    }

    // Decode base64 → bytes
    const bytes = Uint8Array.from(atob(data.data_base64), (c) =>
      c.charCodeAt(0),
    );
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESUME_BYTES) {
      throw new Error("Invalid file size");
    }

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = safeName.includes(".")
      ? safeName.split(".").pop()!.toLowerCase().slice(0, 8)
      : "bin";
    const path = `public/${crypto.randomUUID()}.${ext}`;

    const { data: up, error: upErr } = await supabaseAdmin.storage
      .from("resumes")
      .upload(path, bytes, {
        contentType: data.content_type,
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
    return { path: up.path };
  });



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
        "id, created_at, source, full_name, email, phone, linkedin_url, current_company, current_title, years_of_experience, fit, pipeline_status, stage_id, shortlisted, job_ad_id, resume_url",
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
    const { supabase, userId } = context;
    const [adsRes, settingsRes, countsRes, rolesRes] = await Promise.all([
      supabase
        .from("job_ads")
        .select("id, slug, title, status")
        .order("created_at", { ascending: false }),
      supabase.from("app_settings").select("key, value").eq("key", "app_name").maybeSingle(),
      supabase.from("applications").select("job_ad_id"),
      supabase.from("user_roles").select("role").eq("user_id", userId),
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
    const roles = (rolesRes.data ?? []).map((r) => r.role as string);
    return { appName, ads, roles };
  });

// ---- inviteClient (admin) ----
export const inviteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        client_id: z.string().uuid(),
        email: z.string().trim().email().max(255),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only admins can invite clients.");

    const domain = data.email.split("@")[1]?.toLowerCase() ?? "";
    if (!["goldenpipitrecruiting.com", "mpshahhospital.org"].includes(domain)) {
      throw new Error(
        "Email domain is not approved. Allowed: goldenpipitrecruiting.com, mpshahhospital.org.",
      );
    }

    // Pre-register on allowlist so the new-user trigger admits this email.
    const { error: allowErr } = await supabaseAdmin
      .from("allowed_emails")
      .upsert(
        {
          email: data.email.toLowerCase(),
          role: "client",
          client_id: data.client_id,
          invited_by: userId,
        },
        { onConflict: "email" },
      );
    if (allowErr) throw new Error(allowErr.message);

    const { data: invited, error: invErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    let authUserId = invited?.user?.id ?? null;
    if (invErr) {
      const msg = invErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
        );
        if (!found) throw new Error(invErr.message);
        authUserId = found.id;
      } else {
        throw new Error(invErr.message);
      }
    }
    if (!authUserId) throw new Error("Failed to create user.");

    const { error: linkErr } = await supabaseAdmin
      .from("clients")
      .update({ auth_user_id: authUserId, contact_email: data.email })
      .eq("id", data.client_id);
    if (linkErr) throw new Error(linkErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: authUserId, role: "client" },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, user_id: authUserId };
  });

// ---- listClients (admin) ----
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, contact_name, contact_email, auth_user_id")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { clients: data ?? [] };
  });

// ---- createClient (admin) ----
export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(255),
        contact_name: z.string().trim().max(255).optional().nullable(),
        contact_email: z
          .string()
          .trim()
          .email()
          .max(255)
          .optional()
          .nullable()
          .or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only admins can add clients.");

    const { data: row, error } = await supabaseAdmin
      .from("clients")
      .insert({
        name: data.name,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email ? data.contact_email : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ---- deleteClient (admin) ----
export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ client_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only admins can delete clients.");

    // Look up auth user linked to this client (so we can revoke their client role)
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("auth_user_id")
      .eq("id", data.client_id)
      .maybeSingle();

    // Find dependent job ads
    const { data: jobs } = await supabaseAdmin
      .from("job_ads")
      .select("id")
      .eq("client_id", data.client_id);
    const jobIds = (jobs ?? []).map((j) => j.id);

    if (jobIds.length > 0) {
      const { data: apps } = await supabaseAdmin
        .from("applications")
        .select("id")
        .in("job_ad_id", jobIds);
      const appIds = (apps ?? []).map((a) => a.id);
      if (appIds.length > 0) {
        await supabaseAdmin.from("application_events").delete().in("application_id", appIds);
        await supabaseAdmin.from("applications").delete().in("id", appIds);
      }
      await supabaseAdmin.from("payments").delete().in("job_ad_id", jobIds);
      await supabaseAdmin.from("job_ad_stages").delete().in("job_ad_id", jobIds);
      await supabaseAdmin.from("job_ads").delete().in("id", jobIds);
    }

    if (client?.auth_user_id) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", client.auth_user_id)
        .eq("role", "client");
    }

    const { error } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", data.client_id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
        "id, slug, title, status, roles_count, start_date, linkedin_job_url, jd_url, jd_text, client_id, authorized_at, closed_at, created_at, posting_fee, is_billable, billing_triggered_at",
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
      stage_id: z.string().uuid().nullable().optional(),
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
    const patch: {
      fit?: typeof FIT_VALUES[number];
      pipeline_status?: typeof STATUS_VALUES[number];
      stage_id?: string | null;
      recruiter_notes?: string | null;
      current_company?: string | null;
      current_title?: string | null;
      years_of_experience?: number | null;
      shortlisted?: boolean;
    } = { ...data.patch };
    // Keep pipeline_status in sync when stage_id changes (legacy compat for now)
    if (data.patch.stage_id !== undefined && data.patch.stage_id !== null) {
      const { data: stage } = await supabase
        .from("job_ad_stages")
        .select("legacy_status")
        .eq("id", data.patch.stage_id)
        .maybeSingle();
      if (stage?.legacy_status) {
        patch.pipeline_status = stage.legacy_status as typeof STATUS_VALUES[number];
      }
    }
    const { error } = await supabase
      .from("applications")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- deleteCandidate (admin only) ----
export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only admins can delete candidates.");

    const { data: app } = await supabaseAdmin
      .from("applications")
      .select("id, job_ad_id, resume_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!app) throw new Error("Candidate not found.");

    await supabaseAdmin
      .from("application_events")
      .delete()
      .eq("application_id", data.id);

    const { error: delErr } = await supabaseAdmin
      .from("applications")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    if (app.resume_url) {
      const { error: storageErr } = await supabaseAdmin.storage
        .from("resumes")
        .remove([app.resume_url]);
      if (storageErr) {
        console.error("[deleteCandidate] resume removal failed:", storageErr.message);
      }
    }

    return { ok: true, job_ad_id: app.job_ad_id };
  });


// ---- createCandidate (manual add, scoped to a job ad) ----
const createInput = z.object({
  job_ad_id: z.string().uuid(),
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
    const { supabase, userId } = context;
    // Admin gate: members cannot add candidates manually
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only admins can add candidates.");

    // Force "Sourced" stage for manually-added candidates
    const { data: sourcedStage } = await supabase
      .from("job_ad_stages")
      .select("id, legacy_status")
      .eq("job_ad_id", data.job_ad_id)
      .eq("legacy_status", "sourced")
      .maybeSingle();
    let stage = sourcedStage;
    if (!stage) {
      const { data: firstStage } = await supabase
        .from("job_ad_stages")
        .select("id, legacy_status")
        .eq("job_ad_id", data.job_ad_id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      stage = firstStage;
    }
    const { data: row, error } = await supabase
      .from("applications")
      .insert({
        source: "manual",
        job_ad_id: data.job_ad_id,
        stage_id: stage?.id ?? null,
        pipeline_status: "sourced",
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

// ---- listJobAdStages ----
export const listJobAdStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ job_ad_id: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: stages, error } = await supabase
      .from("job_ad_stages")
      .select("id, label, position, is_default, legacy_status")
      .eq("job_ad_id", data.job_ad_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return { stages: stages ?? [] };
  });

// ---- upsertJobAdStage (admin) ----
const upsertStageInput = z.object({
  id: z.string().uuid().optional(),
  job_ad_id: z.string().uuid(),
  label: z.string().trim().min(1).max(60),
  position: z.number().int().min(1).max(50).optional(),
});

export const upsertJobAdStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => upsertStageInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.id) {
      const patch: { label: string; position?: number } = { label: data.label };
      if (data.position !== undefined) patch.position = data.position;
      const { error } = await supabase
        .from("job_ad_stages")
        .update(patch)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    // Insert: append at end
    let pos = data.position;
    if (pos === undefined) {
      const { data: last } = await supabase
        .from("job_ad_stages")
        .select("position")
        .eq("job_ad_id", data.job_ad_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      pos = (last?.position ?? 0) + 1;
    }
    const { error } = await supabase
      .from("job_ad_stages")
      .insert({ job_ad_id: data.job_ad_id, label: data.label, position: pos });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- deleteJobAdStage (admin) ----
export const deleteJobAdStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("job_ad_stages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- reorderJobAdStages (admin) ----
export const reorderJobAdStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        job_ad_id: z.string().uuid(),
        order: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Two-pass swap to avoid unique (job_ad_id, position) collisions
    for (let i = 0; i < data.order.length; i++) {
      const tempPos = -(i + 1);
      const { error } = await supabase
        .from("job_ad_stages")
        .update({ position: tempPos })
        .eq("id", data.order[i])
        .eq("job_ad_id", data.job_ad_id);
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < data.order.length; i++) {
      const { error } = await supabase
        .from("job_ad_stages")
        .update({ position: i + 1 })
        .eq("id", data.order[i])
        .eq("job_ad_id", data.job_ad_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
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

// ---- getResumeBlob ----
// Streams resume bytes through the app origin so ad blockers / privacy
// extensions can't ERR_BLOCKED_BY_CLIENT the supabase.co URL.
export const getResumeBlob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: file, error } = await supabaseAdmin.storage
      .from("resumes")
      .download(data.path);
    if (error || !file) throw new Error(error?.message || "Resume not found");
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    const base64 = btoa(binary);
    const filename = data.path.split("/").pop() || "resume";
    return {
      base64,
      contentType: file.type || "application/octet-stream",
      filename,
    };
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
