import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/config/company";
import { getPortalShell } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function normalizeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  // Never redirect back to /login itself — that causes nested redirect loops.
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return "";
  return value;
}

function destinationForRoles(roles: string[]): string {
  if (roles.includes("admin")) return "/main";
  if (roles.includes("member")) return "/staff";
  if (roles.includes("client")) return "/client";
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolveDestination = useCallback(async (): Promise<string> => {
    // Honor an explicit, non-surface redirect (e.g. deep link).
    if (
      redirectTo &&
      !redirectTo.startsWith("/portal") &&
      !redirectTo.startsWith("/talentportal") &&
      !redirectTo.startsWith("/main") &&
      !redirectTo.startsWith("/staff") &&
      !redirectTo.startsWith("/client")
    ) {
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Access is invite-only.
          </p>
        </div>
      </div>
    </main>
  );
}
