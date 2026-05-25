CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email citext;
  v_row   public.allowed_emails%ROWTYPE;
BEGIN
  v_email := lower(NEW.email)::citext;

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