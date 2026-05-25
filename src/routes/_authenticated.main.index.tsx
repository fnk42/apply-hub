import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/main/")({
  beforeLoad: () => {
    throw redirect({ to: "/talentportal/main" });
  },
  component: () => null,
});
