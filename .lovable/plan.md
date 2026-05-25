## Plan

1. **Stop the temporary sign-in flash on refresh**
   - Update the protected route gate in `src/routes/_authenticated.tsx` so it waits for a real validated user via `supabase.auth.getUser()` before redirecting.
   - Keep the existing redirect-back behavior, but only send users to `/login` after the session restore/validation has completed and no user exists.

2. **Prevent protected server functions from racing auth hydration**
   - Add the same session-ready check to the portal layout (`src/routes/_authenticated.portal.tsx`) before it calls role-based server functions like `getMyRoles()`.
   - This avoids the first protected server-function call going out without the auth token during a page refresh.

3. **Keep non-admin landing behavior unchanged**
   - Leave the Business Development Manager redirect and admin-only tab restrictions intact.
   - Authenticated clients/members should refresh directly back into `/portal/jobs/business-development-manager` without seeing the login screen.

4. **Quietly fix the current runtime blocker**
   - The preview is also failing on the auth email route because `@react-email/components` does not export `renderAsync` in this project.
   - Replace those imports/usages in the email preview/webhook route with the supported React Email render API so the app can load cleanly.

5. **Verify**
   - Check the relevant dev/runtime output after the change.
   - Confirm the portal route no longer redirects to login while a valid session is being restored.