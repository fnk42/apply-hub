import { createFileRoute, redirect } from "@tanstack/react-router";
import { shellQuery } from "@/lib/portal-shell";

export const Route = createFileRoute("/_authenticated/client/")({
  beforeLoad: async ({ context }) => {
    const { ads } = await context.queryClient.ensureQueryData(shellQuery);
    const firstLive = ads.find((a) => a.status === "live") ?? ads[0];
    if (firstLive) {
      throw redirect({
        to: "/client/jobs/$slug",
        params: { slug: firstLive.slug },
      });
    }
    throw redirect({ to: "/unauthorized" });
  },
  component: () => null,
});
