# Plan: Turn on Auth Emails

The domain `notify.goldenpipitrecruiting.com` is verified, and all auth email templates + routes are **already scaffolded** in the repo. So this is mostly a "wire it up and verify" task, not a build task.

## What I found already in place
- Verified sender domain: `notify.goldenpipitrecruiting.com`
- Auth webhook route: `src/routes/lovable/email/auth/webhook.ts`
- Queue processor route: `src/routes/lovable/email/queue/process.ts`
- Templates in `src/lib/email-templates/`: `signup`, `invite`, `magic-link`, `recovery`, `email-change`, `reauthentication` (all 6 standard auth types)

## What I will do

1. **Run `setup_email_infra`** — idempotent. Ensures the Supabase queue tables (`email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`), pgmq queues (`auth_emails`, `transactional_emails`), the `enqueue_email` / `read_email_batch` / `delete_email` RPCs, the `email_queue_service_role_key` Vault secret, and the `process-email-queue` pg_cron job (runs every 5s, hits `/lovable/email/queue/process`) all exist. If they already do, this is a no-op.

2. **Verify the Supabase Auth Hook is enabled** and points at `/lovable/email/auth/webhook` on the published domain so Supabase forwards signup/invite/magic-link/recovery/email-change/reauth events into the Lovable queue.

3. **Confirm `LOVABLE_API_KEY` is present** (already shown in secrets — should be fine; webhook uses it to verify signature and to send).

## Templates that will be active (already scaffolded, not rewritten)
| Template | Trigger |
|---|---|
| signup | New email/password signup confirmation |
| invite | Admin invites a user via `auth.admin.inviteUserByEmail` |
| magiclink | `signInWithOtp` |
| recovery | Password reset |
| email_change | User changes their email |
| reauthentication | Sensitive-action OTP |

If you want brand styling polish later (logo, colors), that's a separate pass — not in this plan.

## What I will NOT touch (your hard constraint)
- `app_role` enum, `user_roles`, `allowed_emails`, `clients`, `job_ads`, `applications`, `screening_questions`
- Any RLS policy
- `handle_new_user` or any other auth trigger/function
- `_authenticated` gate, client portal routes, role-check code
- The 6 existing template `.tsx` files (left as-is)
- The webhook/queue route source code

## Auth settings changes
**None.** I will not call `configure_auth`. Specifically I will NOT toggle `disable_signup`, `auto_confirm_email`, or anonymous sign-ups. Invite-only signup behavior (via the `handle_new_user` trigger checking `allowed_emails`) stays exactly as it is.

## Edge functions / server code changes
**None.** No file edits, no new files, no edge function deploys. TanStack server routes (webhook + queue processor) deploy with the app on the next publish — they're already in `main`.

## Risks / caveats
- If the Supabase Auth Hook isn't currently pointed at the Lovable webhook URL, no auth emails will fire even after infra setup. I'll surface this and tell you what to flip in **Cloud → Emails** if needed — I won't silently change it.
- pg_cron / queue infra changes from `setup_email_infra` may show up as a Supabase migration for your approval.

## After approval (single tool call)
- `email_domain--setup_email_infra`

Then I'll report back with status and, if anything (like the auth hook activation) needs your click in Cloud → Emails, I'll point you to it. Once you confirm a test email lands, we'll move on to sending the one-time magic link for the seeded user.