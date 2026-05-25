## Plan

1. **All signed-in users land on the BD Manager job ad**
   - In `src/routes/login.tsx`, change role-based routing so admin, member, and client users all go to `/portal/jobs/business-development-manager` after sign-in (instead of admin/member → `/portal`).
   - In `src/routes/_authenticated.portal.index.tsx`, change the safety-net redirect so anyone hitting `/portal` directly is sent to `/portal/jobs/business-development-manager` (no role split).
   - Keep the invite-only domain check unchanged.

2. **Make LinkedIn links open outside the embedded preview**
   - LinkedIn returns `ERR_BLOCKED_BY_RESPONSE` when opened from inside the Lovable preview iframe even with `rel="noopener noreferrer"`, because the response sets headers that disallow iframe-originated popups.
   - Replace the affected anchors with click handlers that call `window.open(url, "_blank", "noopener,noreferrer")` from the top window so the popup is detached from the iframe context. Apply to:
     - candidate name link in the job ad candidate table (`NameCell` in `src/routes/_authenticated.portal.jobs.$slug.tsx`)
     - candidate name link on the candidate detail page (`src/routes/_authenticated.portal.$id.tsx`)
     - job header LinkedIn button (`JdPanel` in `src/routes/_authenticated.portal.jobs.$slug.tsx`)
   - Preserve existing behavior (row click suppression, styling, icon).

No schema, RLS, or auth-provider changes.