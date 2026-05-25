-- 1. Replace handle_new_user trigger so new auth users get NO role by default.
-- Access must be granted explicitly by an admin via the Team admin UI.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally do nothing. New auth users have no portal role until
  -- an admin grants one (via Admin → Team). Without a role, the /portal
  -- guard redirects them to /unauthorized and RLS blocks all reads.
  RETURN NEW;
END;
$function$;

-- 2. Revoke all auto-granted member/client roles from anyone who isn't
-- the founding admin. Felix's admin row (and his redundant member row,
-- since he's admin) are preserved.
DELETE FROM public.user_roles
WHERE user_id <> 'e677a171-a390-4af3-a1c5-e0cb000555fb';