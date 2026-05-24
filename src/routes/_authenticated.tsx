import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { waitForInitialSession } from "@/integrations/supabase/wait-for-session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await waitForInitialSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
