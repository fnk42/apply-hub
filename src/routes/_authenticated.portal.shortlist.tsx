import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPortalShell } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/portal/shortlist")({
  beforeLoad: async () => {
    const { ads } = await getPortalShell();
    const live = ads.find((a) => a.status === "live") ?? ads[0];
    if (live) {
      throw redirect({ to: "/portal/jobs/$slug", params: { slug: live.slug } });
    }
    throw redirect({ to: "/portal/jobs" });
  },
  component: () => null,
});
