-- Revoke execute on trigger-only SECURITY DEFINER functions from public API roles.
-- These functions are only invoked by triggers and should never be callable via the API.

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_application_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maybe_trigger_billing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_job_ad_stages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_posting_fee() FROM PUBLIC, anon, authenticated;

-- Helper functions used inside RLS policies (has_role, is_recruiter_or_admin, is_client_for_job)
-- must remain executable by authenticated users so policies can evaluate them.
-- Revoke from anon since the API never needs them unauthenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_recruiter_or_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_for_job(uuid, uuid) FROM PUBLIC, anon;