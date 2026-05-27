import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listLiveJobAds } from "@/lib/candidates.functions";

// Root URL behavior:
// - Anonymous visitors (e.g. people clicking a LinkedIn ad that points at the
//   bare domain) are sent straight to the first live job ad's apply form.
//   If there are no live ads, fall back to /login.
// - Signed-in users go to /portal, which role-routes to admin/staff/client.
// Direct /apply/$slug deep links are unaffected.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/portal", replace: true });
    }
    try {
      const { ads } = await listLiveJobAds();
      const first = ads?.[0];
      if (first?.slug) {
        throw redirect({
          to: "/apply/$slug",
          params: { slug: first.slug },
          replace: true,
        });
      }
    } catch (e) {
      // If it's already a redirect, rethrow
      if (e && typeof e === "object" && "isRedirect" in (e as object)) throw e;
    }
    throw redirect({ to: "/login", replace: true });
  },
  component: () => null,
});
