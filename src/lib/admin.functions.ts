import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin role required.");
}

// ============ PAYMENTS ============

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, job_ad_id, client_id, amount, currency, status, triggered_by, notes, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const jobIds = Array.from(new Set((data ?? []).map((p) => p.job_ad_id)));
    const clientIds = Array.from(new Set((data ?? []).map((p) => p.client_id)));
    const [jobsRes, clientsRes] = await Promise.all([
      jobIds.length
        ? supabaseAdmin.from("job_ads").select("id, title, slug").in("id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
      clientIds.length
        ? supabaseAdmin.from("clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const jobMap = new Map((jobsRes.data ?? []).map((j: any) => [j.id, j]));
    const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c]));

    return {
      payments: (data ?? []).map((p) => ({
        ...p,
        job: jobMap.get(p.job_ad_id) ?? null,
        client: clientMap.get(p.client_id) ?? null,
      })),
    };
  });

export const markPaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const voidPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "void" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ APP SETTINGS ============

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("key, value");
    if (error) throw new Error(error.message);
    const map: Record<string, any> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return {
      appName:
        (map.app_name as any)?.name ??
        (typeof map.app_name === "string" ? map.app_name : null) ??
        "Project Dashboard",
      defaultPostingFee: Number(map.default_posting_fee ?? 35000),
    };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        appName: z.string().trim().min(1).max(120).optional(),
        defaultPostingFee: z.number().int().min(0).max(100_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const updates: Array<{ key: string; value: any }> = [];
    if (data.appName !== undefined) {
      updates.push({ key: "app_name", value: { name: data.appName } });
    }
    if (data.defaultPostingFee !== undefined) {
      updates.push({ key: "default_posting_fee", value: data.defaultPostingFee });
    }
    for (const u of updates) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============ JOB ADS (admin overview) ============

export const listAllJobAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: ads, error } = await supabaseAdmin
      .from("job_ads")
      .select(
        "id, slug, title, status, roles_count, is_billable, posting_fee, billing_triggered_at, created_at, client_id",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const clientIds = Array.from(new Set((ads ?? []).map((a) => a.client_id)));
    let clientMap = new Map<string, { id: string; name: string }>();
    if (clientIds.length) {
      const { data: cs } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      clientMap = new Map((cs ?? []).map((c) => [c.id, c]));
    }

    // Count any paid payments per job ad to mark "paid"
    const { data: pays } = await supabaseAdmin
      .from("payments")
      .select("job_ad_id, status");
    const paidJobs = new Set(
      (pays ?? []).filter((p) => p.status === "paid").map((p) => p.job_ad_id),
    );
    const pendingJobs = new Set(
      (pays ?? []).filter((p) => p.status === "pending").map((p) => p.job_ad_id),
    );

    return {
      ads: (ads ?? []).map((a) => ({
        ...a,
        client: clientMap.get(a.client_id) ?? null,
        billing_state: paidJobs.has(a.id)
          ? "paid"
          : pendingJobs.has(a.id)
            ? "pending"
            : a.billing_triggered_at
              ? "triggered"
              : a.is_billable
                ? "awaiting_10"
                : "not_billable",
      })),
    };
  });

// ============ NOTIFICATIONS ============

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return { notifications: data ?? [], unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ INTERNAL USERS ============

export const listInternalUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "member"]);
    if (error) throw new Error(error.message);

    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      byUser.set(r.user_id, arr);
    }
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const users = (list?.users ?? [])
      .filter((u) => byUser.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        roles: byUser.get(u.id) ?? [],
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));
    return { users };
  });

export const inviteInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        role: z.enum(["admin", "member"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

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
          role: data.role,
          invited_by: context.userId,
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
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: authUserId, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);
    return { ok: true, user_id: authUserId };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "member"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Remove other internal roles, then upsert the new one
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .in("role", ["admin", "member"]);
    if (delErr) throw new Error(delErr.message);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You can't remove your own access.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .in("role", ["admin", "member"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PAYMENT STATUS CYCLE ============

export const setPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "paid", "void"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch =
      data.status === "paid"
        ? { status: "paid", paid_at: new Date().toISOString() }
        : { status: data.status, paid_at: null };
    const { error } = await supabaseAdmin
      .from("payments")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ONE-OFF: RESET ADMIN PASSWORD ============
// Reads ADMIN_RESET_PASSWORD env var and sets it as the password for
// felix@goldenpipitrecruiting.com. Safe no-op if the env var is unset.

export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const pw = process.env.ADMIN_RESET_PASSWORD;
    if (!pw || pw.length < 8) {
      throw new Error("ADMIN_RESET_PASSWORD secret is not set (min 8 chars).");
    }
    const targetEmail = "felix@goldenpipitrecruiting.com";
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users?.find(
      (u) => u.email?.toLowerCase() === targetEmail,
    );
    if (!user) throw new Error(`User ${targetEmail} not found.`);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: pw,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email: targetEmail };
  });

// ============ ALLOWED EMAILS ============

export const listAllowedEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("allowed_emails")
      .select("email, role, client_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { allowed: data ?? [] };
  });

export const addAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        role: z.enum(["admin", "member", "client"]),
        client_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const domain = data.email.split("@")[1]?.toLowerCase() ?? "";
    if (!["goldenpipitrecruiting.com", "mpshahhospital.org"].includes(domain)) {
      throw new Error(
        "Email domain is not approved. Allowed: goldenpipitrecruiting.com, mpshahhospital.org.",
      );
    }
    if (data.role === "client" && !data.client_id) {
      throw new Error("client_id is required for client role.");
    }
    const { error } = await supabaseAdmin.from("allowed_emails").upsert(
      {
        email: data.email.toLowerCase(),
        role: data.role,
        client_id: data.role === "client" ? data.client_id : null,
        invited_by: context.userId,
      },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.email.toLowerCase() === "felix@goldenpipitrecruiting.com") {
      throw new Error("Cannot remove the primary admin from the allowlist.");
    }
    const { error } = await supabaseAdmin
      .from("allowed_emails")
      .delete()
      .eq("email", data.email.toLowerCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ADMIN DASHBOARD ============

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday-start
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function startOfQuarter(d: Date) {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1));
}
function startOfYear(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const now = new Date();
    const weekStart = startOfWeek(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const quarterStart = startOfQuarter(now).toISOString();
    const yearStart = startOfYear(now).toISOString();
    const trendStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    ).toISOString();

    const [
      liveAdsRes,
      candidatesWeekRes,
      paidPaymentsRes,
      stagesRes,
      eventsRes,
      clientsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("job_ads")
        .select("id, title, slug, status, roles_count, client_id, archived_at")
        .eq("status", "live")
        .is("archived_at", null),
      supabaseAdmin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekStart),
      supabaseAdmin
        .from("payments")
        .select("amount, paid_at")
        .eq("status", "paid")
        .gte("paid_at", trendStart),
      supabaseAdmin
        .from("job_ad_stages")
        .select("id, label, position, legacy_status, job_ad_id"),
      supabaseAdmin
        .from("application_events")
        .select(
          "id, application_id, actor_email, event_type, from_value, to_value, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin.from("clients").select("id, name"),
    ]);

    if (liveAdsRes.error) throw new Error(liveAdsRes.error.message);
    if (paidPaymentsRes.error) throw new Error(paidPaymentsRes.error.message);

    const liveAds = liveAdsRes.data ?? [];
    const liveAdIds = liveAds.map((a) => a.id);

    // Applications scoped to live ads (single read; small portal scale)
    const appsRes = liveAdIds.length
      ? await supabaseAdmin
          .from("applications")
          .select("id, job_ad_id, pipeline_status, stage_id, shortlisted")
          .in("job_ad_id", liveAdIds)
      : { data: [] as any[], error: null };
    if (appsRes.error) throw new Error(appsRes.error.message);
    const apps = appsRes.data ?? [];

    // KPIs
    const openJobs = liveAds.length;
    const liveApplications = apps.length;
    const shortlisted = apps.filter((a) => a.shortlisted).length;
    const candidatesThisWeek = candidatesWeekRes.count ?? 0;

    // Revenue
    const pays = paidPaymentsRes.data ?? [];
    const monthRevenue = pays
      .filter((p) => p.paid_at && p.paid_at >= monthStart)
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const quarterRevenue = pays
      .filter((p) => p.paid_at && p.paid_at >= quarterStart)
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const yearRevenue = pays
      .filter((p) => p.paid_at && p.paid_at >= yearStart)
      .reduce((s, p) => s + (p.amount ?? 0), 0);

    // Revenue trend: trailing 12 months
    const trendMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      trendMap.set(key, 0);
    }
    for (const p of pays) {
      if (!p.paid_at) continue;
      const d = new Date(p.paid_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) ?? 0) + (p.amount ?? 0));
      }
    }
    const revenueTrend = Array.from(trendMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    // Pipeline funnel — aggregate across live ads' stages
    const stages = (stagesRes.data ?? []).filter((s) =>
      liveAdIds.includes(s.job_ad_id),
    );
    // Group by label (default stages share names across ads)
    const funnelMap = new Map<
      string,
      { key: string; label: string; position: number; count: number }
    >();
    // Build a quick lookup: stage_id → label/legacy_status/position
    const stageById = new Map(stages.map((s) => [s.id, s]));
    for (const s of stages) {
      const k = s.legacy_status ?? s.label;
      if (!funnelMap.has(k)) {
        funnelMap.set(k, {
          key: k,
          label: s.label,
          position: s.position,
          count: 0,
        });
      }
    }
    for (const a of apps) {
      let key: string | null = null;
      if (a.stage_id && stageById.has(a.stage_id)) {
        const s = stageById.get(a.stage_id)!;
        key = s.legacy_status ?? s.label;
      } else if (a.pipeline_status) {
        const k: string = a.pipeline_status;
        key = k;
        if (!funnelMap.has(k)) {
          funnelMap.set(k, {
            key: k,
            label: k.replace(/_/g, " "),
            position: 99,
            count: 0,
          });
        }
      }
      if (key && funnelMap.has(key)) {
        funnelMap.get(key)!.count += 1;
      }
    }
    const funnel = Array.from(funnelMap.values()).sort(
      (a, b) => a.position - b.position,
    );

    // Top clients by open roles
    const clientMap = new Map(
      (clientsRes.data ?? []).map((c: any) => [c.id, c.name as string]),
    );
    const rolesByClient = new Map<string, number>();
    for (const ad of liveAds) {
      rolesByClient.set(
        ad.client_id,
        (rolesByClient.get(ad.client_id) ?? 0) + (ad.roles_count ?? 0),
      );
    }
    const topClients = Array.from(rolesByClient.entries())
      .map(([id, openRoles]) => ({
        id,
        name: clientMap.get(id) ?? "—",
        openRoles,
      }))
      .sort((a, b) => b.openRoles - a.openRoles)
      .slice(0, 5);

    // Recent activity — enrich with candidate name
    const events = eventsRes.data ?? [];
    const appIds = Array.from(new Set(events.map((e) => e.application_id)));
    let nameMap = new Map<string, string>();
    if (appIds.length) {
      const { data: appRows } = await supabaseAdmin
        .from("applications")
        .select("id, full_name")
        .in("id", appIds);
      nameMap = new Map((appRows ?? []).map((r: any) => [r.id, r.full_name]));
    }
    const recentActivity = events.map((e) => ({
      id: e.id,
      application_id: e.application_id,
      candidate_name: nameMap.get(e.application_id) ?? "candidate",
      actor_email: e.actor_email,
      event_type: e.event_type,
      from_value: e.from_value,
      to_value: e.to_value,
      created_at: e.created_at,
    }));

    return {
      kpis: { openJobs, liveApplications, candidatesThisWeek, shortlisted },
      revenue: {
        month: monthRevenue,
        quarter: quarterRevenue,
        year: yearRevenue,
        trend: revenueTrend,
      },
      funnel,
      topClients,
      recentActivity,
    };
  });
