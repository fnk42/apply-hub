# Prompt 6.5 — Login UX + open up invite gate + fix sign-in bounce

Three small, related fixes. No new routes, no new tables.

## 1. Password visibility toggle (`src/routes/login.tsx`)

- `const [showPassword, setShowPassword] = useState(false)`.
- Password `<Input>` `type` becomes `showPassword ? "text" : "password"`.
- Wrap input in a `relative` div; absolute ghost button on the right toggles state.
- `Eye` / `EyeOff` from `lucide-react` (already a dep).
- `aria-label`, `tabIndex={-1}` so it doesn't steal tab order from the submit button.

## 2. Remove the domain whitelist (two places)

### a) Client — `src/routes/login.tsx`
Delete `ALLOWED_DOMAINS`, `isAllowedDomain()`, and the `if (!isAllowedDomain(...)) { signOut(); toast.error(...) }` branch inside the session `useEffect`. Also drop the footer line "Approved domains: ...".

**This also fixes the `info@...` bounce.** Right now: sign in succeeds → navigate to `/main` → login page's session effect fires → email domain isn't on the whitelist → `supabase.auth.signOut()` → `_authenticated` sees no session → kicks back to `/login`. Removing the whitelist removes the bounce.

### b) Server — `public.handle_new_user()` (migration)
Drop the hard-coded domain check. Keep the `allowed_emails` lookup — that's still the real invite gate, so an arbitrary stranger still can't sign up.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email citext;
  v_row   public.allowed_emails%ROWTYPE;
BEGIN
  v_email := lower(NEW.email)::citext;

  SELECT * INTO v_row FROM public.allowed_emails WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access is invite-only';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_row.role)
  ON CONFLICT DO NOTHING;

  IF v_row.role = 'client' AND v_row.client_id IS NOT NULL THEN
    UPDATE public.clients
       SET auth_user_id = NEW.id
     WHERE id = v_row.client_id
       AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
```

Net effect: you can invite any email domain via `allowed_emails` and test with gmail/outlook addresses.

## 3. About the `info@` password

I don't have access to it — Supabase stores passwords hashed, so neither admins nor I can read them. Options:
- I add a one-click "Send password reset" admin action on the user (small extra scope), OR
- You reset it yourself from Cloud → Users, OR
- Use the existing reset flow if `/reset-password` is wired up.

**Not included in this plan** — tell me which option you want and I'll add it as a follow-up.

## Files touched
- `src/routes/login.tsx` — password eye toggle + remove domain whitelist + footer copy
- One migration — replace `handle_new_user()` body

## Verification
- Sign in with `info@...`: lands on `/main` (or role-appropriate surface) without bouncing back to `/login`.
- Eye toggle reveals/hides password text.
- Add a personal gmail to `allowed_emails` → sign up succeeds (trigger no longer rejects).
- Existing `@goldenpipitrecruiting.com` / `@mpshahhospital.org` accounts unaffected.

## Out of scope
- Retrieving the `info@` password (impossible — needs reset).
- Prompt 7 (sidebar search) / Prompt 8 (cleanup) — still queued.
