import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPortalShell } from "@/lib/candidates.functions";

const EMPTY_SHELL = { appName: "Project Dashboard", roles: [] as string[], ads: [] as any[] };

export const shellQuery = queryOptions({
  queryKey: ["portal-shell"],
  queryFn: async () => {
    // Skip the protected RPC entirely when there is no session — avoids 401s
    // on public pages (e.g. /login) after sign-out.
    const { data } = await supabase.auth.getSession();
    if (!data.session) return EMPTY_SHELL;
    try {
      return await getPortalShell();
    } catch {
      return EMPTY_SHELL;
    }
  },
  staleTime: 30_000,
});
