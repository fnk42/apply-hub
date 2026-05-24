
-- Application events: only system (SECURITY DEFINER triggers run as owner with BYPASSRLS) may insert
DROP POLICY IF EXISTS "system inserts events" ON public.application_events;

-- Notifications: same — block public/auth insert path; only service role / definer code may insert
DROP POLICY IF EXISTS "system inserts notifications" ON public.notifications;

-- Pin search_path on the only function that was missing it
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke EXECUTE on SECURITY DEFINER helpers from public roles. They're used by RLS
-- and triggers, both of which run as the function owner — callers don't need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_recruiter_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_client_for_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_application_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_job_ad_stages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maybe_trigger_billing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_posting_fee() FROM PUBLIC, anon, authenticated;

-- Storage: remove the duplicate + unscoped resume INSERT policies, replace with a scoped one
DROP POLICY IF EXISTS "anon can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "anyone uploads resumes" ON storage.objects;

CREATE POLICY "public resume uploads scoped to public folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = 'public'
  );
