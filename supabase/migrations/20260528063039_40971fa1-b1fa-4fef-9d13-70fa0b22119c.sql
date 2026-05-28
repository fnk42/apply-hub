REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'resumes';