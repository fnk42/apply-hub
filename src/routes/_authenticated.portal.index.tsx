import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMyRoles, getPortalShell } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/portal/")({
  beforeLoad: async () => {
    const { roles } = await getMyRoles();
    const isInternal = roles.includes("admin") || roles.includes("member");
    // Client-only users land on the BD Manager job page
    if (!isInternal && roles.includes("client")) {
      throw redirect({
        to: "/portal/jobs/$slug",
        params: { slug: "business-development-manager" },
      });
    }
    const { ads } = await getPortalShell();
    const live = ads.filter((a) => a.status === "live");
    if (live.length === 1) {
      throw redirect({ to: "/portal/jobs/$slug", params: { slug: live[0].slug } });
    }
    throw redirect({ to: "/portal/jobs" });
  },
  component: () => null,
});
