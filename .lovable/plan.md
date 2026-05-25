# Remove email domain whitelist

The "only goldenpipitrecruiting.com / mpshahhospital.org allowed" error comes from three server functions that still hard-check the domain. The DB trigger already only enforces the `allowed_emails` allowlist, which is the right gate — anyone you invite can sign in, anyone you don't can't.

## Changes

**`src/lib/admin.functions.ts`**
- `inviteInternalUser` (lines 258–263): delete the domain check block.
- `addAllowedEmail` (lines 426–431): delete the domain check block.

**`src/lib/candidates.functions.ts`**
- `inviteClient` (around line 291): delete the matching domain check block.

No other logic changes — Zod `.email()` validation, the allowlist upsert, and the Supabase `inviteUserByEmail` call all stay as-is.

## Result

Admins can invite any valid email address (Gmail, Yahoo, custom domains, etc.). Sign-in is still restricted to invited addresses via the `allowed_emails` table and the `handle_new_user` trigger.

## Out of scope

- No DB migration (trigger is already correct).
- No UI changes — the "Allowed domains" hint text, if any, can be updated in a follow-up if you point it out.
