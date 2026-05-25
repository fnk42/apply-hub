import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPortalShell } from "@/lib/candidates.functions";

const EMPTY_SHELL = { appName: "Project Dashboard", roles: [] as string[], ads: [] as any[] };

export const shellQuery = queryOptions({
  queryKey: ["portal-shell"],
  queryFn: async () => {
    // Only short-circuit when there is genuinely no session (public pages
    // like /login after sign-out). Otherwise call the real RPC and let
    // errors propagate so we don't silently render an "unauthorized" UI.
    const { data } = await supabase.auth.getSession();
    if (!data.session) return EMPTY_SHELL;
    return await getPortalShell();
  },
  staleTime: 30_000,
  retry: 1,
});
