## Goal

Lock the recruiter portal behind an admin-managed email allowlist. **Zero changes** to the public apply flow — `/`, `/apply/:slug`, and the resume upload path stay exactly as they are right now since the ad is live.

## Answers chosen

- **Access model**: Admin invites by email (allowlist)
- **Sign-in methods**: Keep Google + email/password
- **Existing accounts**: Revoke all non-admin roles; re-grant manually

## Current users

| Email | Roles now | After fix |
|---|---|---|
| felix@goldenpipitrecruiting.com | admin + member | unchanged |
| felix.njenga@gmail.com | member (auto-granted) | **revoked** — add to allowlist if you want them back |

## Changes

### 1. Database migration

- **New `portal_invites` table**: `email` (citext, unique), `role` (`app_role`, default `member`), `invited_by`, `invited_at`, `accepted_at`, `accepted_user_id`. RLS: admin-only.
- **Replace `handle_new_user()` trigger** so it looks the new user's email up in `portal_invites`:
  - Match → insert the invited role into `user_roles`, stamp the invite as accepted.
  - No match → insert nothing. The user exists in `auth.users` but has zero roles, so `/portal` redirects them to `/unauthorized`.
- **New trigger on `portal_invites` INSERT**: if the invited email already has an auth user, grant the role immediately (covers the "invite added after they signed up" case).
- **Revoke existing non-admin roles**: `DELETE FROM user_roles WHERE user_id <> '<felix-admin-uuid>' AND role <> 'admin'`. Felix's admin + member rows are untouched.

### 2. Admin UI — add an Invites section to `_authenticated.portal.admin.tsx`

- List invites (email, role, status: pending/accepted, invited date).
- "Add invite" form: email + role dropdown (`member` / `admin`).
- "Revoke" button per invite: deletes the invite row AND any matching `user_roles` row in one server fn call.
- Backed by two new server fns in `src/lib/admin.functions.ts` (`addPortalInvite`, `revokePortalInvite`), both gated by `requireSupabaseAuth` + admin-role check (same pattern as the existing `deleteCandidate`).

### 3. Login page (`src/routes/login.tsx`) — copy-only tweak

- Keep Google button and email/password form intact.
- Change the "Need an account? Sign up" affordance to "Need access? Contact your admin." Sign-in itself is unchanged; only the implicit "anyone can self-onboard" cue goes away. The real gate is the trigger.

### 4. Explicitly untouched

- `src/routes/index.tsx` — public roles list. No changes.
- `src/routes/apply.$slug.tsx` — public application form. No changes.
- `src/lib/candidates.functions.ts` `getPublicJobAd`, `submitApplication`, `uploadPublicResume` — no changes.
- `applications` table RLS policy `anyone can submit application` — stays.
- `resumes` storage bucket policies — stay.
- No `disable_signup` toggle on Supabase Auth. Account creation still works; we just don't auto-grant roles.

## How it works end-to-end

```text
Public applicant → /apply/:slug → unchanged, works exactly as today
                                  (no auth, no role check, just submits)

New recruiter → admin adds their email to portal_invites
              → recruiter signs in (Google or email/password)
              → handle_new_user() trigger sees the invite, grants role
              → /portal loads normally

Random person → signs up with any email
             → trigger finds no invite, grants no role
             → /portal redirects them to /unauthorized
             → recruiter data stays invisible (RLS also blocks them)
```

## Out of scope

- Sending invite emails automatically (admin tells the person "go sign in" out of band).
- 2FA / SSO.
- Touching the public apply flow in any way.
