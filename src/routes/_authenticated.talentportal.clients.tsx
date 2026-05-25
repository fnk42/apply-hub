import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

export const Route = createFileRoute("/_authenticated/talentportal/clients")({
  beforeLoad: async ({ context }) => {
    const { roles, ads } = await context.queryClient.ensureQueryData(shellQuery);
    if (!roles.includes("client") && !roles.includes("admin")) {
      throw redirect({ to: "/unauthorized" });
    }
    const firstLive = ads.find((a) => a.status === "live") ?? ads[0];
    if (firstLive) {
      throw redirect({
        to: "/staff/jobs/$slug",
        params: { slug: firstLive.slug },
      });
    }
    throw redirect({ to: "/staff/jobs" });
  },
  component: () => null,
});
