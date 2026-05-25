import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/config/company";
import { getPortalShell } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ALLOWED_DOMAINS = ["goldenpipitrecruiting.com", "mpshahhospital.org"];

function isAllowedDomain(email: string | null | undefined) {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

function normalizeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function destinationForRoles(roles: string[]): string {
  if (roles.includes("admin")) return "/talentportal/main";
  if (roles.includes("member")) return "/talentportal/staff";
  if (roles.includes("client")) return "/talentportal/clients";
  return "/unauthorized";
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Sign in — ${company.name}` }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: normalizeRedirect(
      typeof search.redirect === "string" ? search.redirect : undefined,
    ),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resolveDestination = useCallback(async (): Promise<string> => {
    // Honor an explicit, non-portal redirect (e.g. deep link).
    if (redirectTo && !redirectTo.startsWith("/portal") && !redirectTo.startsWith("/talentportal")) {
      return redirectTo;
    }
    try {
      const { roles } = await getPortalShell();
      return destinationForRoles(roles);
    } catch {
      return "/unauthorized";
    }
  }, [redirectTo]);

  const goToDestination = useCallback(async () => {
    const to = await resolveDestination();
    void navigate({ to: to as any, replace: true });
  }, [navigate, resolveDestination]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      if (!isAllowedDomain(session.user.email)) {
        await supabase.auth.signOut();
        toast.error("Access is invite-only. Your email domain is not approved.");
        return;
      }
      const to = await resolveDestination();
      if (!cancelled) void navigate({ to: to as any, replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate, resolveDestination]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await goToDestination();
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  const cameFromApply = redirectTo.startsWith("/apply");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        {cameFromApply && (
          <Link to="/" className="mb-6 text-sm text-muted-foreground hover:text-foreground">
            ← Back to apply page
          </Link>
        )}
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">{company.name} portal</p>

          <form onSubmit={handleEmail} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Access is invite-only. Approved domains: goldenpipitrecruiting.com, mpshahhospital.org.
          </p>
        </div>
      </div>
    </main>
  );
}
