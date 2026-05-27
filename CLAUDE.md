# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun dev` — start the Vite dev server (TanStack Start in dev mode)
- `bun run build` — production build (Cloudflare Workers target via `@cloudflare/vite-plugin`)
- `bun run build:dev` — build in development mode
- `bun run preview` — preview the built bundle
- `bun run lint` — ESLint over the whole repo
- `bun run format` — Prettier write

No test runner is configured. Both Bun (`bun.lock`) and npm (`package-lock.json`) lockfiles exist; Bun is the active package manager.

Path alias: `@/*` → `src/*` (TS + Vite). Use `@/components/ui/...`, `@/lib/...`, etc.

## Stack

- **TanStack Start** (React 19, file-based routing via `@tanstack/react-router`), deployed to Cloudflare Workers (`wrangler.jsonc`, entry `src/server.ts`).
- **Vite** with `@lovable.dev/vite-tanstack-config` — this preset already includes `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, the Cloudflare plugin (build-only), `componentTagger` (dev-only), the `@/*` alias, and React/TanStack dedupe. **Do not re-add any of these to `vite.config.ts`** or the app will break with duplicate plugins.
- **shadcn/ui** (new-york style, slate base, no prefix) in `src/components/ui/` — generated, do not hand-edit unless intentionally customizing. `components.json` is the source of truth.
- **Tailwind v4** (`@tailwindcss/vite` plugin, single `src/styles.css`).
- **Supabase** for auth + Postgres, plus a server-side admin client that bypasses RLS.
- **Lovable Cloud**: OAuth (`@lovable.dev/cloud-auth-js`), transactional email (`@lovable.dev/email-js`), webhook verification (`@lovable.dev/webhooks-js`).
- **TanStack Query** for client-side caching; the `QueryClient` is injected into the router context in `src/router.tsx` and provided in `__root.tsx`.

## Architecture

### Routing (`src/routes/`)

File-based via `@tanstack/react-router`. Conventions:
- Dots separate URL segments: `_authenticated.staff.jobs.$slug.tsx` → `/staff/jobs/$slug`.
- `$param` is a path param; bare `$` is a catch-all; `index` resolves to the parent path.
- Leading `_` makes a route pathless (layout-only), e.g. `_authenticated` is the auth gate but adds no URL segment.
- A few routes use the subdirectory style instead of dot-flat (`_authenticated/client.*.tsx`) — the conventions co-exist; match the surrounding file when adding siblings.
- `routeTree.gen.ts` is auto-generated; never edit by hand.
- Server-only API routes are `.ts` (not `.tsx`) under `routes/lovable/email/...` and use TanStack's `server.handlers` form (see `routes/lovable/email/auth/webhook.ts`).

The `_authenticated` layout sets **`ssr: false`** intentionally — Supabase sessions live in `localStorage`, so child loaders/`beforeLoad`s would either crash SSR or cause a login flash. Keep new authenticated routes under this layout.

### Auth model

Two clients:
- `@/integrations/supabase/client` — anon/publishable key, browser session (Proxy-wrapped lazy singleton). Use in client and SSR code that needs RLS-scoped reads.
- `@/integrations/supabase/client.server` — `supabaseAdmin`, **service-role**, **bypasses RLS**. Only import from `*.server.ts` files or server function handlers; never from client-reachable code.

Two middlewares (in `src/integrations/supabase/`):
- `attachSupabaseAuth` (function/client middleware) — pulls the current `access_token` from the browser session and attaches it as a `Bearer` header to every serverFn RPC. **Globally registered** in `src/start.ts`; do not register per-fn.
- `requireSupabaseAuth` (function/server middleware) — validates the bearer via `supabase.auth.getClaims` and adds `{ supabase, userId, claims }` to handler `context`. Apply per server function that needs an authenticated caller.

The `AuthInvalidator` in `__root.tsx` clears the React Query cache on `SIGNED_OUT` and invalidates queries + the router on `SIGNED_IN`/`USER_UPDATED`. Don't duplicate this listener elsewhere.

### Server functions (`src/lib/*.functions.ts`)

The standard pattern for RPCs callable from the client. Examples:

```ts
// Public (no auth)
export const listLiveJobAds = createServerFn({ method: "GET" }).handler(async () => { ... });

// Authenticated
export const someFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({...}).parse(d))
  .handler(async ({ context, data }) => { ... });
```

Admin-only functions add an explicit role check against `user_roles` (see `assertAdmin` in `admin.functions.ts`) — the bearer just proves *who* the user is, not that they're admin.

### SSR error handling

`src/server.ts` is the Cloudflare Workers entry. It wraps `@tanstack/react-start/server-entry` because h3 swallows in-handler throws into a JSON `{"unhandled":true,"message":"HTTPError"}` 500 response that `try/catch` alone cannot intercept. The wrapper:
1. detects that body shape and replaces it with the branded HTML in `lib/error-page.ts`,
2. drains the original error via `lib/error-capture.ts` (global `error` / `unhandledrejection` listeners) so the stack still reaches the logs.

`src/start.ts` adds a request middleware that catches non-`statusCode` throws and serves the same branded page. If you introduce intentional HTTP errors, give them a `statusCode` so they pass through.

### Email pipeline

Supabase auth events POST to **`/lovable/email/auth/webhook`** (signature-verified with `LOVABLE_API_KEY`). The webhook renders React Email templates (`src/lib/email-templates/`), enqueues a row into a Supabase queue via the `enqueue_email` RPC, and logs to `email_send_log`. **`/lovable/email/queue/process`** is the dispatcher — it pulls jobs, calls `sendLovableEmail`, retries on 429 (honoring `Retry-After`), moves 403s straight to DLQ. To add a new transactional template: drop a new component in `email-templates/`, add it to both `EMAIL_TEMPLATES` and `EMAIL_SUBJECTS` in the webhook, ensure Supabase's auth hook config emits the matching `action_type`.

### Database

Supabase project `yclzkcuvhcpyixouvedc` (`supabase/config.toml`). Migrations live under `supabase/migrations/` with the timestamp-uuid filename convention; apply via the Supabase CLI. RLS is the source of truth for client-side queries — when something works in `supabaseAdmin` but fails in `supabase`, suspect missing RLS policies before assuming a bug.

## Gotchas

- **Never import `server-only`** — ESLint blocks it (see `eslint.config.js`). TanStack Start uses `*.server.ts` filename suffixes or `@tanstack/react-start/server-only` instead.
- Server-only env (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) is loaded into `process.env` by `vite.config.ts` via `loadEnv(..., "")`. **Do not** add these to `envDefine` / `VITE_*` prefixes — that leaks them into the client bundle.
- The `entities` package is aliased in `vite.config.ts` because of a transitive resolution bug; leave it alone unless you're upgrading the dep.
- The `_authenticated.tsx` gate runs auth checks in `useEffect` and renders a spinner until a session is confirmed. Do not move this logic into `beforeLoad` — that would re-enable SSR for the subtree and reintroduce the login flash.
- shadcn `Sonner` toaster lives in `__root.tsx`; don't mount additional `Toaster` instances in child layouts.
