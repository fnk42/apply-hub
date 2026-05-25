import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy compatibility: any /portal/X URL that no longer has a matching
// route file forwards to the equivalent path on the new surface.
//   /portal/jobs/...      -> /staff/jobs/...
//   /portal/candidates... -> /staff/candidates...
//   /portal/shortlist     -> /staff/shortlist
//   /portal/activity      -> /staff/activity
//   /portal/clients...    -> /main/clients...
//   /portal/admin         -> /main/admin
//   /portal/settings      -> /main/settings
//   anything else         -> /portal (role-routes via portal layout)
export const Route = createFileRoute("/_authenticated/portal/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    const first = rest.split("/")[0] ?? "";
    const STAFF = new Set(["jobs", "candidates", "shortlist", "activity"]);
    const MAIN = new Set(["clients", "admin", "settings"]);
    let surface: "staff" | "main" | null = null;
    if (STAFF.has(first)) surface = "staff";
    else if (MAIN.has(first)) surface = "main";
    if (!surface) throw redirect({ to: "/portal", replace: true });
    throw redirect({ href: `/${surface}/${rest}`, replace: true });
  },
  component: () => null,
});
