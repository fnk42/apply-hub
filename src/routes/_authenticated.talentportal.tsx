import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { shellQuery } from "@/lib/portal-shell";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/portal/AppSidebar";
import { NotificationBell } from "@/components/portal/NotificationBell";

export const Route = createFileRoute("/_authenticated/talentportal")({
  beforeLoad: async ({ context }) => {
    const { roles } = await context.queryClient.ensureQueryData(shellQuery);
    const ok =
      roles.includes("admin") ||
      roles.includes("member") ||
      roles.includes("client");
    if (!ok) throw redirect({ to: "/unauthorized" });
  },
  component: TalentPortalLayout,
});

function TalentPortalLayout() {
  const { data } = useSuspenseQuery(shellQuery);
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
            <span className="text-sm text-muted-foreground">{data.appName}</span>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
