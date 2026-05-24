import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPortalShell } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/portal/")({
  beforeLoad: async () => {
    const { ads } = await getPortalShell();
    const live = ads.filter((a) => a.status === "live");
    if (live.length === 1) {
      throw redirect({ to: "/portal/jobs/$slug", params: { slug: live[0].slug } });
    }
    throw redirect({ to: "/portal/jobs" });
  },
  component: () => null,
});
