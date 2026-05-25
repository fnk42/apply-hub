import { queryOptions } from "@tanstack/react-query";
import { getPortalShell } from "@/lib/candidates.functions";

export const shellQuery = queryOptions({
  queryKey: ["portal-shell"],
  queryFn: () => getPortalShell(),
  staleTime: 30_000,
});
