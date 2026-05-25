import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { company } from "@/config/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function normalizeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/portal";
  return value;
}

const POST_LOGIN_KEY = "pipit:post_login_redirect";

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

      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(POST_LOGIN_KEY);
        if (stored) sessionStorage.removeItem(POST_LOGIN_KEY);
      } catch {
        stored = null;
      }
      const target = normalizeRedirect(stored ?? destination);
      void navigate({ to: target as any, replace: true });
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
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        goToDestination();
      }
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      try {
        sessionStorage.setItem(POST_LOGIN_KEY, destination);
      } catch {
        // sessionStorage unavailable; we'll fall back to the URL's redirect param
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) goToDestination();
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
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

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              or email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
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
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
