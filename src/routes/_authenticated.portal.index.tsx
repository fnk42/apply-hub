import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

// /portal root: role-route to the matching surface. This mirrors the
// beforeLoad in _authenticated.portal.tsx for the bare path case.
export const Route = createFileRoute("/_authenticated/portal/")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    if (roles.includes("admin")) throw redirect({ to: "/main", replace: true });
    if (roles.includes("member")) throw redirect({ to: "/staff", replace: true });
    if (roles.includes("client")) throw redirect({ to: "/client", replace: true });
    throw redirect({ to: "/unauthorized" });
  },
  component: () => null,
});
