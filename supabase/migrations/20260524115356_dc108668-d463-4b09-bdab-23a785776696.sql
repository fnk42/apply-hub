CREATE OR REPLACE FUNCTION public.is_client_for_job(_user_id uuid, _job_ad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_ads j
    JOIN public.clients c ON c.id = j.client_id
    WHERE j.id = _job_ad_id
      AND c.auth_user_id = _user_id
  )
$$;

CREATE POLICY "clients read own job_ads"
  ON public.job_ads
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "clients read own applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND public.is_client_for_job(auth.uid(), job_ad_id)
  );

CREATE POLICY "clients read own job_ad_stages"
  ON public.job_ad_stages
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND public.is_client_for_job(auth.uid(), job_ad_id)
  );

CREATE POLICY "clients read own client row"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND auth_user_id = auth.uid()
  );

CREATE POLICY "anon can upload resumes"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'resumes');
