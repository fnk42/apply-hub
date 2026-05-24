
## Why links flash through `/login`

The `_authenticated` route guard does this on every navigation:

```ts
beforeLoad: async ({ location }) => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
}
```

`supabase.auth.getUser()` makes a **network call** and, more importantly, can resolve as "no user" before the client has finished restoring the session from `localStorage` (cold tab, hard refresh, or fast click after load). When that happens:

1. Guard sees no user → redirects to `/login`.
2. Moments later, Supabase finishes hydrating the session and fires `onAuthStateChange` (`INITIAL_SESSION` / `SIGNED_IN`).
3. Our root `AuthInvalidator` calls `router.invalidate()`, the `/login` page's own `forwardWhenAuthenticated` effect fires, and the user is finally sent to the originally requested URL.

Net effect: every protected link "first goes to login, then lands where it was pointing." It's a race between the guard and session hydration, not a routing bug.

## Fix

1. **Use the local session in the guard, not a network `getUser()` call.**
   In `src/routes/_authenticated.tsx`, replace `supabase.auth.getUser()` with `supabase.auth.getSession()`. `getSession()` reads the persisted session synchronously from storage (after the SDK's initial restore) and does not hit the network, eliminating the race for already-signed-in users.

2. **Wait for the initial session restore before deciding to redirect.**
   On a true cold load `getSession()` can still return `null` for a tick. Add a tiny helper (e.g. `waitForInitialSession()`) that:
   - calls `getSession()` once; if a session exists, returns it,
   - otherwise subscribes to `onAuthStateChange` and resolves on the first `INITIAL_SESSION` event (with a short timeout, e.g. 1500 ms, after which we treat it as unauthenticated).
   The `_authenticated` `beforeLoad` awaits this helper and only redirects to `/login` when it resolves with no session. This removes the false-negative redirect entirely.

3. **Stop invalidating the whole router on every auth event.**
   In `src/routes/__root.tsx`, `AuthInvalidator` currently calls `router.invalidate()` + `queryClient.invalidateQueries()` on every `onAuthStateChange` event, including `INITIAL_SESSION` and `TOKEN_REFRESHED`. That's what re-triggers the guard mid-navigation and contributes to the flash. Narrow it to only react to meaningful transitions: `SIGNED_IN`, `SIGNED_OUT`, and `USER_UPDATED`. Ignore `INITIAL_SESSION` and `TOKEN_REFRESHED`.

4. **Keep `/login`'s existing `forwardWhenAuthenticated` as a safety net** but it should rarely fire after the above fixes, because authenticated users will no longer be bounced to `/login` in the first place.

5. **Verify in the preview.** After the fix:
   - Hard-refresh `/portal/activity` while signed in → lands directly on `/portal/activity`, no `/login` flash.
   - Click between sidebar links → no intermediate `/login` navigation in the address bar or network panel.
   - Sign out → next protected click goes straight to `/login` (no loop).
   - Sign in via email and via Google → lands on the originally requested URL.

## Files touched

- `src/routes/_authenticated.tsx` — switch to `getSession()` + `waitForInitialSession()` helper, only redirect after we know there's truly no session.
- `src/routes/__root.tsx` — make `AuthInvalidator` ignore `INITIAL_SESSION` and `TOKEN_REFRESHED`.
- (Optional) small helper file like `src/integrations/supabase/wait-for-session.ts` for the one-shot session-ready promise, so both the guard and any future loaders can reuse it.

No schema, RLS, or server-function changes. No UI changes.
