import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { getMyRoles } from "@/lib/candidates.functions";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/config/company";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: async () => {
    try {
      const { roles } = await getMyRoles();
      const ok = roles.includes("admin") || roles.includes("recruiter");
      if (!ok) throw redirect({ to: "/unauthorized" });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/portal" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded bg-accent text-accent-foreground text-xs font-bold">
              {company.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>{company.name} — Portal</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {email && <span className="hidden sm:inline opacity-80">{email}</span>}
            <Button
              size="sm"
              variant="secondary"
              onClick={signOut}
              className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
