import { useEffect, useState } from "react";
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // Authenticated routes depend on the Supabase session, which only exists
  // in the browser (localStorage). Skip SSR so child loaders/beforeLoads
  // don't run server-side without an auth token (which would crash SSR or
  // redirect to /login and cause a login flash on refresh).
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const href = useRouterState({ select: (r) => r.location.href });
  const [status, setStatus] = useState<"checking" | "authed" | "anon">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    // getSession() restores from localStorage synchronously on the client.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "authed" : "anon");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setStatus(session ? "authed" : "anon");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "anon") {
      navigate({
        to: "/login",
        search: { redirect: href },
        replace: true,
      });
    }
  }, [status, href, navigate]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
