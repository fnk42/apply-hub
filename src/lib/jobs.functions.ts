import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Only admins can perform this action.");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---- createJobAd (admin) ----
const createInput = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only")
    .optional(),
  jd_text: z.string().trim().max(20000).optional().or(z.literal("")),
  jd_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  linkedin_job_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  roles_count: z.number().int().min(1).max(50).default(1),
  start_date: z.string().optional().or(z.literal("")),
  is_billable: z.boolean().default(true),
  posting_fee_cents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  status: z.enum(["pending_authorization", "live", "draft"]).default("pending_authorization"),
});

export const createJobAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const baseSlug = data.slug ? data.slug : slugify(data.title);
    if (!baseSlug) throw new Error("Could not derive a slug from the title.");

    // Ensure slug uniqueness by appending -2, -3, ... if needed
    let slug = baseSlug;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await supabaseAdmin
        .from("job_ads")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }

    const insert: Record<string, any> = {
      client_id: data.client_id,
      title: data.title,
      slug,
      jd_text: data.jd_text || null,
      jd_url: data.jd_url || null,
      linkedin_job_url: data.linkedin_job_url || null,
      roles_count: data.roles_count,
      start_date: data.start_date || null,
      is_billable: data.is_billable,
      status: data.status,
      created_by: userId,
    };
    if (data.posting_fee_cents != null) {
      insert.posting_fee_cents = data.posting_fee_cents;
    }
    if (data.status === "live") {
      insert.authorized_by = userId;
      insert.authorized_at = new Date().toISOString();
    }

    const { data: row, error } = await supabaseAdmin
      .from("job_ads")
      .insert(insert as never)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, slug: row.slug };
  });

// ---- setJobAdStatus (admin) — close / reopen ----
export const setJobAdStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["live", "closed", "pending_authorization"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const patch: Record<string, any> = { status: data.status };
    if (data.status === "closed") {
      patch.closed_at = new Date().toISOString();
    } else {
      patch.closed_at = null;
      if (data.status === "live") {
        patch.authorized_by = userId;
        patch.authorized_at = new Date().toISOString();
      }
    }

    const { error } = await supabaseAdmin
      .from("job_ads")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
