import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/staff/")({
  beforeLoad: () => {
    throw redirect({ to: "/talentportal/staff" });
  },
  component: () => null,
});
