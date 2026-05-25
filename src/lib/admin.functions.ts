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
