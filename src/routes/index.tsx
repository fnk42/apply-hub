import { createFileRoute, redirect } from "@tanstack/react-router";

// The root URL is no longer a public page. Send everyone to /portal,
// which is gated by _authenticated (redirects to /login if not signed in)
// and then role-routes admins to /main, members to /staff, clients to /client.
// Direct apply links (/apply/$slug) are unaffected.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/portal", replace: true });
  },
  component: () => null,
});
