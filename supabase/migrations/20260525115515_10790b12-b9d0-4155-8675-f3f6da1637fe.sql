
-- 1. Tighten app_settings SELECT to internal staff only
DROP POLICY IF EXISTS "authenticated read app_settings" ON public.app_settings;

CREATE POLICY "internal read app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'member'));

-- 2. Add UPDATE/DELETE policies on resumes storage bucket for admins
CREATE POLICY "admins update resumes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete resumes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'));
