import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

export const Route = createFileRoute("/_authenticated/staff")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    if (!roles.includes("admin") && !roles.includes("member")) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: () => <Outlet />,
});
