BEGIN;

-- Drop dependent objects
ALTER TABLE public.allowed_emails DROP CONSTRAINT IF EXISTS client_requires_client_id;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- Detach columns from enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.allowed_emails ALTER COLUMN role TYPE text USING role::text;

-- Recreate enum without 'recruiter'
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'client');

-- Reattach columns
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
ALTER TABLE public.allowed_emails ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- Recreate check constraint
ALTER TABLE public.allowed_emails
  ADD CONSTRAINT client_requires_client_id
  CHECK ((role = 'client'::public.app_role AND client_id IS NOT NULL)
      OR role <> 'client'::public.app_role);

-- Recreate has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Recreate policies that were dropped via CASCADE
CREATE POLICY "admins manage allowed_emails" ON public.allowed_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "internal read app_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'member'));

CREATE POLICY "admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients read own client row" ON public.clients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client') AND auth_user_id = auth.uid());

CREATE POLICY "admins manage job_ad_stages" ON public.job_ad_stages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients read own job_ad_stages" ON public.job_ad_stages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client') AND public.is_client_for_job(auth.uid(), job_ad_id));
CREATE POLICY "internal read job_ad_stages" ON public.job_ad_stages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'member'));

CREATE POLICY "admins manage job_ads" ON public.job_ads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients read own job_ads" ON public.job_ads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client')
    AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));
CREATE POLICY "internal read job_ads" ON public.job_ads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'member'));

CREATE POLICY "admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients read own paid payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client') AND status = 'paid'
    AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete applications" ON public.applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients read own applications" ON public.applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client') AND public.is_client_for_job(auth.uid(), job_ad_id));

COMMIT;
