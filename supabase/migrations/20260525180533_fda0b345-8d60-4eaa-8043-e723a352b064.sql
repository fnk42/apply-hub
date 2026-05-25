CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
             '-+', '-', 'g'
           )
         );
$$;

REVOKE EXECUTE ON FUNCTION public.set_client_slug() FROM PUBLIC, anon, authenticated;
