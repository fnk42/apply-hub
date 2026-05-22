
-- Auto-grant recruiter role on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Activity log triggers
DROP TRIGGER IF EXISTS applications_log_insert ON public.applications;
CREATE TRIGGER applications_log_insert
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

DROP TRIGGER IF EXISTS applications_log_update ON public.applications;
CREATE TRIGGER applications_log_update
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

-- updated_at trigger
DROP TRIGGER IF EXISTS applications_set_updated_at ON public.applications;
CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
