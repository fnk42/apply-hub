import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

export const Route = createFileRoute("/_authenticated/client")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    // Admins allowed for support/debug.
    if (!roles.includes("client") && !roles.includes("admin")) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: () => <Outlet />,
});
