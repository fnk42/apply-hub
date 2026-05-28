CREATE POLICY "clients update own applications"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND is_client_for_job(auth.uid(), job_ad_id)
)
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role)
  AND is_client_for_job(auth.uid(), job_ad_id)
);