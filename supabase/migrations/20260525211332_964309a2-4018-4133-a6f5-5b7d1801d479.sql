
-- 1. Storage policies for resumes bucket (admin-only update/delete)
CREATE POLICY "Admins can update resume files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete resume files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Revoke anon/public EXECUTE on SECURITY DEFINER queue functions and set search_path
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
