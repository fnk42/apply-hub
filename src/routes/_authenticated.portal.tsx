import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyRoles, getPortalShell } from "@/lib/candidates.functions";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/portal/AppSidebar";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: async () => {
    try {
      const { roles } = await getMyRoles();
      const ok =
        roles.includes("admin") ||
        roles.includes("recruiter") ||
        roles.includes("member");
      if (!ok) throw redirect({ to: "/unauthorized" });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { data } = useQuery({
    queryKey: ["portal-shell"],
    queryFn: () => getPortalShell(),
  });
  const appName = data?.appName ?? "Project Dashboard";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-6">
            <SidebarTrigger />
            <div className="flex-1" />
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

