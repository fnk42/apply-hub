# Fix "ERR_BLOCKED_BY_CLIENT" on resume links

## What's happening

The resume link points to `https://yclzkcuvhcpyixouvedc.supabase.co/...`. Some ad blockers and privacy extensions (uBlock Origin, AdGuard, Brave Shields, corporate web filters) block any URL containing `supabase.co` by pattern match. Chrome surfaces this as `ERR_BLOCKED_BY_CLIENT`. Nothing reaches the server — it's blocked in the browser before the request leaves.

You can confirm it in 5 seconds: open the same link in an Incognito window with extensions disabled — it'll work.

## Fix: proxy the file through our own domain

Add a server route that fetches the file from storage server-side and streams it back to the browser, so the URL the browser sees is `/api/resume/...` on the Lovable domain — no `supabase.co` in it, nothing for blockers to match.

### New file: `src/routes/api/resume.$applicationId.tsx`

- Auth-gated TanStack server route (admin/member can read any; client can read only their own job's applications — same rules as the candidate page).
- Looks up `applications.resume_url` for the id.
- Uses `supabaseAdmin.storage.from('resumes').createSignedUrl(path, 60)` server-side, fetches the bytes, and streams them back with `content-type: application/pdf` (or the stored type) and `content-disposition: inline; filename="..."`.
- Returns 403 / 404 cleanly if not allowed or missing.

### Update the candidate UI

Wherever resume is rendered (candidate row on `/portal/jobs/$slug`, candidate detail `/portal/$id`):
- Change the "View resume" link target from the raw Supabase signed URL to `/api/resume/<application_id>`.
- Open in new tab (`target="_blank" rel="noopener"`).

### Cleanup

- Remove the existing client-side `createSignedUrl` call paths used only for display (keep any that genuinely need a direct URL).

## Out of scope

- Custom domain setup (would also fix this, but proxying is faster and works for all users).
- File download vs. inline preview toggle (default to inline; can add `?download=1` later).

Approve and I'll implement.
