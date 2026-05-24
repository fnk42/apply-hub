# Fix "Open resume" being blocked by Chrome (ERR_BLOCKED_BY_CLIENT)

## What's actually happening

The server proxy (`getResumeBlob`) is working — bytes are reaching the
browser fine. The failure is the **next step**: we create a `blob:` URL
and call `window.open(blobUrl, "_blank")`. A Chrome extension on your
"Work" profile (or an enterprise policy) blocks navigation to `blob:`
URLs in a new tab → `ERR_BLOCKED_BY_CLIENT`. Same family of blocker
that broke the original `supabase.co` link, just one layer deeper.

## Fix — stop opening blob: URLs in a new tab

Two changes, both in `src/lib/open-resume.ts` (no server changes).

### 1. Default action: trigger a download instead of a tab open

Instead of `window.open(blobUrl)`, create a hidden
`<a href={blobUrl} download={filename}>` element, click it, then revoke.
Downloads via blob URLs are not blocked by the extensions / policies
that block blob-tab navigations. The recruiter gets the resume as a
normal file in their Downloads folder and opens it locally.

### 2. Same-tab fallback if the click is suppressed

If anything goes wrong with the synthetic click (very rare), fall back
to `location.href = blobUrl` in the current tab — that path is also not
flagged by the blocker.

The function signature stays the same so every caller (candidate detail
page, candidates list, shortlist page) keeps working with no edits.

### 3. UI copy tweak

Change the button label from "Open resume" to "Download resume" on
`src/routes/_authenticated.portal.$id.tsx` to match the new behavior.
The `Download` icon is already in use.

## Bonus: Staff sign-in link on the public landing page

Right now `gptalentportal.com/` is the public "Open roles" page and
there's no visible way to reach the admin portal — you have to know
the `/login` URL. Add a small, low-contrast **"Staff sign in"** link in
the footer area of `src/routes/index.tsx` linking to `/login`. The
public applicant flow is unchanged; staff get one click to the portal
from the root domain.

## What this does NOT touch

- No DB / RLS / storage changes.
- No changes to the public apply form or the upload path we shipped earlier.
- No changes to auth.
- The server proxy `getResumeBlob` stays as-is — it's working correctly.

## How we'll verify

1. Click "Download resume" on a candidate detail page on Chrome with
   the same extensions enabled — file downloads, no `ERR_BLOCKED_BY_CLIENT`.
2. Visit `https://gptalentportal.com/` — see "Staff sign in" link,
   click it → land on `/login`, sign in → land in the portal.
3. Public apply flow at `/apply/<slug>` is unchanged.
