import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

export const Route = createFileRoute("/_authenticated/talentportal/")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    if (roles.includes("admin")) throw redirect({ to: "/talentportal/main" });
    if (roles.includes("member")) throw redirect({ to: "/talentportal/staff" });
    if (roles.includes("client")) throw redirect({ to: "/talentportal/clients" });
    throw redirect({ to: "/unauthorized" });
  },
  component: () => null,
});
