## Problem

The reset email lands in inbox, but clicking the link opens Lovable's hosted page instead of `gptalentportal.com/reset-password`. Two causes:

1. **`redirectTo` uses `window.location.origin`** in `src/routes/login.tsx` (the forgot-password form). If the request is initiated from the Lovable preview/published `*.lovable.app` host, the link redirects back there.
2. **Supabase's default auth email template** wraps the link through Supabase's `/auth/v1/verify` endpoint and, when the explicit `redirectTo` isn't in the allowlist, falls back to the project's **Site URL** — currently the Lovable default — so the user ends up on Lovable's page.

## Plan

### 1. Hard-code the production domain as `redirectTo`
In `src/routes/login.tsx` (forgot-password handler) replace `window.location.origin` with a fixed base — `https://gptalentportal.com` — so every reset link, regardless of where it was triggered from, points to our domain. (Server-side `inviteClient` / admin reset already use `gptalentportal.com` as the fallback; we'll mirror that on the client.)

### 2. Add `gptalentportal.com` to the auth redirect allowlist + Site URL
Set the Supabase Auth **Site URL** to `https://gptalentportal.com` and add `https://gptalentportal.com/**` (plus the `www` variant) to the **Additional Redirect URLs** allowlist. Without this, Supabase silently ignores the `redirectTo` and bounces to whatever Site URL is configured (currently lovable.app).

This is done from **Cloud → Users → Auth Settings → URL Configuration**. I'll surface the dialog for you to apply, since the API tool we have (`configure_auth`) does not expose Site URL / allowlist.

### 3. (Optional but recommended) Scaffold branded auth email templates
This routes the email link through our own `/lovable/email/auth/webhook` server route on the custom domain instead of Supabase's hosted verify page, so the entire flow stays on `gptalentportal.com`. Templates will inherit the app's brand colors. Requires the email domain to already be verified (it is — emails are landing).

### Files changed
- `src/routes/login.tsx` — replace `window.location.origin` with `https://gptalentportal.com` in the forgot-password call.
- (If you approve step 3) `supabase/functions/auth-email-hook/*` + `_shared/email-templates/*.tsx` scaffolded automatically.

### What you'll need to do manually
Update Site URL + redirect allowlist in Cloud → Users → Auth Settings. I'll give you the exact values once you approve.
