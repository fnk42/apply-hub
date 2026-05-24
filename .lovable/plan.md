## Plan

1. **Restore the recommended Google OAuth redirect**
   - Change Google sign-in to use `redirect_uri: window.location.origin`, which is the managed Lovable Cloud OAuth default.
   - Store the intended post-login destination (`/portal` or the `redirect` query param) in browser storage before starting Google sign-in.

2. **Forward after OAuth using the stored destination**
   - When `/login` loads and detects a valid session, read the stored destination and navigate there client-side.
   - Keep the current client-side navigation fix so the app does not full-reload back into `/login`.

3. **Handle blocked/embedded popup behavior better**
   - If Google sign-in returns an error such as popup blocked/cancelled, reset the button and show a clear toast instead of leaving the user thinking nothing happened.
   - Keep the button loading only while the auth call is actually pending.

4. **Verify in preview**
   - Open `/login?redirect=/portal`, click “Continue with Google,” and confirm it reaches the Google account screen in the browser tool.
   - Check console/network logs for auth or dynamic import errors.

## Note

I tested the current button in a top-level preview and it does reach Google. If it still does nothing inside the embedded Lovable preview in incognito, that can be a preview popup restriction; testing from the full preview URL or a published URL is the reliable confirmation path.