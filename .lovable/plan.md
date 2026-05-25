# Prompt 6.6 — Candidates table: pagination, row actions, faster fit, password reset

Five changes, all scoped to the existing job-slug candidates table and the login flow. No DB schema changes.

## 1. Paginate candidates (50/page) — `src/routes/_authenticated.staff.jobs.$slug.tsx`

- `const [page, setPage] = useState(1)`, `const PAGE_SIZE = 50`.
- After computing the filtered `rows` array, slice for display: `pageRows = rows.slice((page-1)*50, page*50)`.
- `useEffect` resets `page` to 1 whenever `tab`, `stageFilter`, or `search` changes.
- Footer below table: "Showing X–Y of N" with Prev / Next + current page indicator, shown only when `rows.length > 50`.
- Mirror in `src/routes/_authenticated/client.jobs.$slug.tsx` for consistency.

## 2. Three-dot row action → candidate "more" — same file

- Add trailing column `<TableHead className="w-[40px]" />`.
- Per row: `DropdownMenu` with a ghost `MoreVertical` icon button. `onClick={(e) => e.stopPropagation()}` on the trigger so the row's own click doesn't fire.
- Menu items:
  - **Open candidate** → `navigate({ to: "/staff/$id", params: { id: c.id } })`
  - **Open LinkedIn** (only if `c.linkedin_url` is a URL) → `openExternal(c.linkedin_url)`
  - **Open resume** (only if `c.resume_url`) — uses existing helper
  - **Toggle shortlist**
  - **Clear fit rating** → sets fit back to `unrated`

## 3. Visual affordance: name is a clickable link — same file

The `NameCell` already opens LinkedIn when `linkedin_url` is a URL, but the click target is too subtle. The whole row is clickable and navigates to the candidate detail page, so the name needs to be clearly a separate, secondary action.

- When `linkedin_url` is a valid URL, render the name in `text-primary` with an underline that appears on hover (`hover:underline`). The existing `NameCell` component already has `font-medium` and `hover:underline` but it doesn't stand out enough.
- Change the text colour to `text-blue-600 dark:text-blue-400` (only when it is a valid LinkedIn link). Keep the trailing `ExternalLink` icon.
- When `linkedin_url` is missing, render name as plain `text-foreground` with no underline, exactly as it is now.
- No additional icons, no logos, just a stronger colour + underline to signal the link.

## 4. Faster fit rating + click-count semantics — same file

The 1-second lag is `await updateCandidate(...)` + `qc.invalidateQueries(...)` triggering a full refetch before re-render. Fix:

- **Optimistic update**: on click, `qc.setQueryData(["candidates", ad.id], ...)` patches the candidate in cache immediately; mutation runs in background; revert + toast on error.
- **Click-count semantics**: replace cycle with count-within-window.
  - `clickCountRef = useRef<Map<id, {count, timer}>>()`.
  - On click: increment count, clear pending timer, set a fresh 400 ms timer. When timer fires, map count → fit:
    - 1 → `weak`
    - 2 → `medium`
    - 3+ → `strong`
  - Optimistic-update + mutate after the timer resolves.
  - "Clear fit rating" lives in the three-dot menu (item above) to return to `unrated`.
- Tooltip changes from "Click to cycle fit" to "1 = weak, 2 = medium, 3 = strong".

## 5. Password reset — `src/routes/login.tsx` + new `src/routes/reset-password.tsx`

- **On the login form**: under "Sign in", a "Forgot password?" link toggles to a reset-request panel: email input + "Send reset link". Calls:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  ```
  Toast: "If that email exists, a reset link has been sent." (don't leak existence).
- **New public route `/reset-password`** (outside `_authenticated`): listens for `PASSWORD_RECOVERY` on `supabase.auth.onAuthStateChange`, shows a new-password form (with the same show/hide eye toggle), calls `supabase.auth.updateUser({ password })`, redirects to `/login` with a success toast.

Works for `info@…` too — send a reset from the login page, set a new password, sign in normally.

## Files touched
- `src/routes/_authenticated.staff.jobs.$slug.tsx` — pagination, three-dot menu column, stronger link colour on name, optimistic fit + click-count
- `src/routes/_authenticated/client.jobs.$slug.tsx` — pagination + stronger link colour on name
- `src/routes/login.tsx` — "Forgot password?" link + inline reset-request panel
- `src/routes/reset-password.tsx` — new public route for completing the reset

## Out of scope
- Server-side per-page query (client-side slicing is fine for current list sizes).
- Admin-triggered "send reset to this user" button in Settings — easy follow-up if needed.
- Prompt 7 (sidebar search) / Prompt 8 (cleanup).
