import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy redirect: anything under /portal/* (not already matched by a more
// specific portal route file) forwards to the same path under /talentportal/*.
export const Route = createFileRoute("/_authenticated/portal/$")({
  beforeLoad: ({ params, location }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    throw redirect({
      href: `/talentportal/${rest}${location.searchStr ?? ""}`,
      replace: true,
    } as any);
  },
  component: () => null,
});
