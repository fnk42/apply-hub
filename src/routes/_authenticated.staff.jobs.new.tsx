import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/staff/jobs/new")({
  beforeLoad: () => {
    throw redirect({ to: "/main/jobs/new" });
  },
});
