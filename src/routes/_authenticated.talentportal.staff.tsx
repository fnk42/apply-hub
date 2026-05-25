import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "./_authenticated.talentportal";

export const Route = createFileRoute("/_authenticated/talentportal/staff")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    if (!roles.includes("member") && !roles.includes("admin")) {
      if (roles.includes("client")) throw redirect({ to: "/talentportal/client" });
      throw redirect({ to: "/unauthorized" });
    }
    // For now, send staff straight to the jobs list.
    throw redirect({ to: "/talentportal/jobs" });
  },
  component: () => null,
});
