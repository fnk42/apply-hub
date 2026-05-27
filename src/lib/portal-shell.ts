import { queryOptions } from "@tanstack/react-query";
import { getPortalShell } from "@/lib/candidates.functions";

export const shellQuery = queryOptions({
  queryKey: ["portal-shell"],
  // The _authenticated layout guarantees a session before children mount,
  // so always call the real RPC and let real errors propagate instead of
  // faking an empty roles array (which caused /unauthorized redirects).
  queryFn: () => getPortalShell(),
  staleTime: 30_000,
  retry: 1,
});
