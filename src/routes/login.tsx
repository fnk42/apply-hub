import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { company } from "@/config/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function normalizeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/portal";
  return value;
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
  const destination = redirectTo;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goToDestination = useCallback(() => {
    void navigate({ to: destination as any, replace: true });
  }, [destination, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function forwardWhenAuthenticated() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      void navigate({ to: normalizeRedirect(destination) as any, replace: true });
    }
    forwardWhenAuthenticated();
    return () => {
      cancelled = true;
    };
  }, [destination, navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      goToDestination();
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link
          to="/"
          className="mb-6 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to apply page
        </Link>
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Recruiter sign in
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.name} portal
          </p>

          <form onSubmit={handleEmail} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Access is invite-only. Need an account? Ask an admin to add you.
          </p>
        </div>
      </div>
    </main>
  );
}
