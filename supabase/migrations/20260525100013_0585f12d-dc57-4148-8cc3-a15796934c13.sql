
-- 1) allowed_emails table
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email citext PRIMARY KEY,
  role app_role NOT NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invited_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_requires_client_id CHECK (
    (role = 'client' AND client_id IS NOT NULL) OR (role <> 'client')
  )
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage allowed_emails" ON public.allowed_emails;
CREATE POLICY "admins manage allowed_emails" ON public.allowed_emails
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Seed felix as admin (idempotent)
INSERT INTO public.allowed_emails (email, role)
VALUES ('felix@goldenpipitrecruiting.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- 3) Replace handle_new_user: enforce domain + allowlist, auto-grant role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  citext;
  v_domain text;
  v_row    public.allowed_emails%ROWTYPE;
BEGIN
  v_email := lower(NEW.email)::citext;
  v_domain := split_part(NEW.email, '@', 2);

  IF v_domain NOT IN ('goldenpipitrecruiting.com', 'mpshahhospital.org') THEN
    RAISE EXCEPTION 'Access is invite-only';
  END IF;

  SELECT * INTO v_row FROM public.allowed_emails WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access is invite-only';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_row.role)
  ON CONFLICT DO NOTHING;

  IF v_row.role = 'client' AND v_row.client_id IS NOT NULL THEN
    UPDATE public.clients
       SET auth_user_id = NEW.id
     WHERE id = v_row.client_id
       AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
