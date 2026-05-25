## Why invites aren't arriving

Two independent problems:

1. **No custom auth email sender is wired up.** The verified domain `notify.goldenpipitrecruiting.com` exists, but the project has no auth email hook, so `supabase.auth.admin.inviteUserByEmail(...)` falls back to Supabase's built‑in email service. That service is heavily rate‑limited (≈4/hour) and frequently silently drops invites — which matches what you're seeing.
2. **Re‑inviting an existing user sends nothing.** Auth logs show `/invite → 422 email_exists` on the most recent attempt. Both `inviteClient` and `inviteInternalUser` catch that error, link the existing `auth_user_id`, and return success — but they never trigger a new email. So any user who was ever invited before gets no follow‑up email on subsequent "Invite" clicks.

## Plan

1. **Set up branded auth emails on the verified domain**
   - Scaffold Lovable auth email templates so invite / magic‑link / recovery / signup emails are sent from `notify.goldenpipitrecruiting.com` via Lovable Emails (queued, retried, logged).
   - Apply the portal's brand styling (serif heading, neutral palette, white email background) to the invite + magic‑link templates so the email matches the app.
   - Once active, `inviteUserByEmail` will be delivered through this pipeline instead of Supabase's default sender.

2. **Make "Invite" always send an email, even for existing users**
   - In `inviteClient` (`src/lib/candidates.functions.ts`) and `inviteInternalUser` (`src/lib/admin.functions.ts`), when `inviteUserByEmail` returns `email_exists`:
     - Look up the existing user (already done).
     - Then call `supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: <portal URL> } })` so the same auth email pipeline sends a fresh sign‑in link.
     - Keep the existing role / `auth_user_id` linking logic unchanged.
   - For first‑time invites, keep `inviteUserByEmail` (which already sends the invite email via the new hook).

3. **Surface failures in the UI**
   - If link generation fails, propagate a clear error to the toast (`"Failed to send invite email: …"`) instead of returning `ok: true`, so an admin notices when delivery is broken.

4. **Verification after deploy**
   - Re‑invite the affected client/internal user from the UI.
   - Confirm a row appears in `email_send_log` with `status = sent` and `template_name = auth_emails`.
   - Confirm the recipient receives the email from `…@notify.goldenpipitrecruiting.com`.

No DB schema, RLS, or routing changes. Auth provider settings stay as‑is (Google + email).
