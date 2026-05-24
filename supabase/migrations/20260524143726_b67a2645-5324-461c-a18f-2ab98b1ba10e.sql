
-- These helpers are referenced inside RLS policies. RLS expressions are
-- evaluated with the caller's privileges, so the caller MUST be able to
-- execute them. The SECURITY DEFINER body is safe: it only returns a boolean
-- about role membership and never exposes any row data.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_recruiter_or_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_for_job(uuid, uuid) TO anon, authenticated;
