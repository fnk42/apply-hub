## Goal

Create one shared client login `team@infinitytechafrica.com` for Infinite Tech Africa, reusing the existing one-client-one-user model. No schema, RLS, or auth-code changes.

## Steps

1. **Look up the Infinite Tech Africa client id** (`SELECT id, auth_user_id FROM clients WHERE name ILIKE 'Infinite Tech Africa'`) and confirm current `auth_user_id` points at felix.njenga.

2. **Insert allowed_emails row** (migration, since allowed_emails RLS is admin-only and we have no admin session):
   ```sql
   INSERT INTO public.allowed_emails (email, role, client_id)
   VALUES ('team@infinitytechafrica.com', 'client', '<infinite-tech-id>');
   ```

3. **Create the auth user** via Supabase admin API (service role): email `team@infinitytechafrica.com`, password `Infinity@2026!`, `email_confirm: true`. Run as a one-off script using `SUPABASE_SERVICE_ROLE_KEY` (same approach used previously for kafwande@mpshahhospital.org). The `handle_new_user` trigger will:
   - insert `user_roles` row with role `client` (only — no member role)
   - attempt to set `clients.auth_user_id` ONLY if currently NULL (it isn't, so it'll be a no-op — handled in step 4)

4. **Reassign `clients.auth_user_id`** to the new user (data update via insert tool):
   ```sql
   UPDATE public.clients
   SET auth_user_id = '<new-user-id>'
   WHERE id = '<infinite-tech-id>';
   ```
   This is what makes the RLS scoping resolve to team@. Felix loses Infinite Tech Africa client-portal access (he was a test user — confirm this is intended; flagged below).

5. **Verify**:
   - `auth.users` contains team@infinitytechafrica.com with `email_confirmed_at` set
   - `user_roles` has exactly one row for this user: `role = 'client'` (no `member`)
   - `clients.auth_user_id` for Infinite Tech Africa = new user id
   - Simulate the RLS check: `SELECT id, title FROM job_ads WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = '<new-user-id>')` returns the `business-development-customer-service-executive` ad and only Infinite Tech Africa ads
   - Confirm no MP Shah / MK Photography ads are visible under that scoping
   - No code changes, so build is unaffected — confirm via the normal build hook

## One thing to confirm before I run it

Felix Njenga's user is currently `clients.auth_user_id` for Infinite Tech Africa. After reassigning, **Felix will no longer be able to log into the client portal as Infinite Tech Africa**. You said he's a test user, so I'll assume that's fine — but say the word if you want me to leave Felix with some other access first (e.g. assign him to a different client, or keep him as a member). Otherwise I'll proceed as above on switch to build mode.
