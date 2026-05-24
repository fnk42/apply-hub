
-- clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_email text,
  notes text,
  auth_user_id uuid,
  contract_ad_allowance integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- job_ads
CREATE TABLE public.job_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  jd_url text,
  jd_text text,
  linkedin_job_url text,
  status text NOT NULL DEFAULT 'pending_authorization'
    CHECK (status IN ('pending_authorization','live','closed')),
  roles_count integer NOT NULL DEFAULT 1,
  start_date date,
  closed_at timestamptz,
  posting_fee_cents integer,
  is_billable boolean NOT NULL DEFAULT false,
  billing_triggered_at timestamptz,
  created_by uuid,
  authorized_by uuid,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_ads_client_id ON public.job_ads(client_id);
CREATE INDEX idx_job_ads_status ON public.job_ads(status);

ALTER TABLE public.job_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage job_ads" ON public.job_ads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "recruiters and members read job_ads" ON public.job_ads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'recruiter')
    OR public.has_role(auth.uid(), 'member')
  );

CREATE TRIGGER set_job_ads_updated_at
  BEFORE UPDATE ON public.job_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- app_settings
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins write app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed
INSERT INTO public.clients (id, name, notes, contract_ad_allowance)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Golden Pipit Group',
  'Seed client created during Project Dashboard v2 rollout.',
  1
);

INSERT INTO public.job_ads (
  id, client_id, title, slug, status, roles_count, start_date, authorized_at
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Business Manager',
  'business-manager',
  'live',
  1,
  CURRENT_DATE,
  now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('app_name', '"Project Dashboard"'::jsonb);

-- applications.job_ad_id
ALTER TABLE public.applications
  ADD COLUMN job_ad_id uuid REFERENCES public.job_ads(id) ON DELETE RESTRICT;

UPDATE public.applications
SET job_ad_id = '00000000-0000-0000-0000-000000000010'
WHERE job_ad_id IS NULL;

ALTER TABLE public.applications
  ALTER COLUMN job_ad_id SET NOT NULL;

CREATE INDEX idx_applications_job_ad_id ON public.applications(job_ad_id);
