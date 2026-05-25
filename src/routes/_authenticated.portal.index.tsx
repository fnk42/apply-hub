import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portal/")({
  beforeLoad: async () => {
    throw redirect({
      to: "/portal/jobs/$slug",
      params: { slug: "business-development-manager" },
    });
  },
  component: () => null,
});
