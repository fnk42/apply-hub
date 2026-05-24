import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Activity,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { getPortalShell } from "@/lib/candidates.functions";

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "live", label: "Live", statuses: ["live"] },
  { key: "pending", label: "Pending", statuses: ["pending_authorization", "draft"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["portal-shell"],
    queryFn: () => getPortalShell(),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const appName = data?.appName ?? "Project Dashboard";
  const ads = data?.ads ?? [];
  const roles = data?.roles ?? [];
  const isInternal =
    roles.includes("admin") || roles.includes("member");
  const isAdmin = roles.includes("admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Link to="/portal" className="flex flex-col leading-tight">
          <span className="font-serif text-lg tracking-tight text-sidebar-foreground">
            {appName}
          </span>
          <span className="text-xs text-sidebar-foreground/60">
            {isInternal ? "Search Portal" : "Client Portal"}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((g) => {
          const items = ads.filter((a) => g.statuses.includes(a.status));
          if (items.length === 0) return null;
          // Clients only ever see live ads — collapse the "Live" label
          if (!isInternal && g.key !== "live") return null;
          return (
            <SidebarGroup key={g.key}>
              {isInternal && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((a) => (
                    <SidebarMenuItem key={a.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === `/portal/jobs/${a.slug}`}
                      >
                        <Link
                          to="/portal/jobs/$slug"
                          params={{ slug: a.slug }}
                          className="flex items-center gap-2"
                        >
                          <Briefcase className="h-4 w-4" />
                          <span className="truncate">{a.title}</span>
                          {a.count > 0 && (
                            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] tabular-nums text-sidebar-accent-foreground">
                              {a.count}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {isInternal && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/portal/activity")}>
                    <Link to="/portal/activity" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Activity Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/portal/clients")}>
                      <Link to="/portal/clients" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span>Clients</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/portal/settings")}>
                    <Link to="/portal/settings" className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {email && (
          <div className="mb-2 truncate text-xs text-sidebar-foreground/70">
            {email}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
