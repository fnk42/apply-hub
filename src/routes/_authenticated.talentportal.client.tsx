import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "./_authenticated.talentportal";

export const Route = createFileRoute("/_authenticated/talentportal/client")({
  beforeLoad: async ({ context }) => {
    const { roles, ads } = await context.queryClient.ensureQueryData(shellQuery);
    if (!roles.includes("client") && !roles.includes("admin")) {
      throw redirect({ to: "/unauthorized" });
    }
    // Send to the client's first live ad if there is one, else the jobs list.
    const firstLive = ads.find((a) => a.status === "live") ?? ads[0];
    if (firstLive) {
      throw redirect({
        to: "/talentportal/jobs/$slug",
        params: { slug: firstLive.slug },
      });
    }
    throw redirect({ to: "/talentportal/jobs" });
  },
  component: () => null,
});
