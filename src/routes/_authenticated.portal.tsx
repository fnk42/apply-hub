import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shellQuery } from "@/lib/portal-shell";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/portal/AppSidebar";
import { NotificationBell } from "@/components/portal/NotificationBell";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: async ({ context }) => {
    // Wait for the Supabase session to hydrate so the bearer token is
    // attached when getPortalShell runs. Without this the first call races
    // session restore and 401s, which then renders as /unauthorized.
    const { data } = await supabase.auth.getUser();
    if (!data.user) return; // parent _authenticated will redirect to /login
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    const ok =
      roles.includes("admin") ||
      roles.includes("member") ||
      roles.includes("client");
    if (!ok) throw redirect({ to: "/unauthorized" });
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { data } = useSuspenseQuery(shellQuery);
  const appName = data.appName;


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
            <span className="text-sm text-muted-foreground">{appName}</span>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

