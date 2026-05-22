
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_recruiter_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','recruiter')
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-assign recruiter role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'recruiter')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'public_form',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  cover_note TEXT,
  screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  fit TEXT NOT NULL DEFAULT 'unrated',
  pipeline_status TEXT NOT NULL DEFAULT 'sourced',
  recruiter_notes TEXT,
  honeypot TEXT
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit application" ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (honeypot IS NULL OR honeypot = '');

CREATE POLICY "recruiters view applications" ON public.applications
  FOR SELECT TO authenticated
  USING (public.is_recruiter_or_admin(auth.uid()));

CREATE POLICY "recruiters update applications" ON public.applications
  FOR UPDATE TO authenticated
  USING (public.is_recruiter_or_admin(auth.uid()))
  WITH CHECK (public.is_recruiter_or_admin(auth.uid()));

CREATE POLICY "recruiters insert applications" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_recruiter_or_admin(auth.uid()));

CREATE POLICY "admins delete applications" ON public.applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity log
CREATE TABLE public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT
);

CREATE INDEX application_events_app_id_idx ON public.application_events(application_id, created_at DESC);

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiters view events" ON public.application_events
  FOR SELECT TO authenticated
  USING (public.is_recruiter_or_admin(auth.uid()));

CREATE POLICY "system inserts events" ON public.application_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Auto-log changes
CREATE OR REPLACE FUNCTION public.log_application_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_events (application_id, actor_user_id, actor_email, event_type, to_value)
    VALUES (NEW.id, auth.uid(), v_email,
      CASE WHEN NEW.source = 'manual' THEN 'manual_added' ELSE 'created' END,
      NEW.source);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.fit IS DISTINCT FROM OLD.fit THEN
      INSERT INTO public.application_events (application_id, actor_user_id, actor_email, event_type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), v_email, 'fit_changed', OLD.fit, NEW.fit);
    END IF;
    IF NEW.pipeline_status IS DISTINCT FROM OLD.pipeline_status THEN
      INSERT INTO public.application_events (application_id, actor_user_id, actor_email, event_type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), v_email, 'status_changed', OLD.pipeline_status, NEW.pipeline_status);
    END IF;
    IF NEW.recruiter_notes IS DISTINCT FROM OLD.recruiter_notes THEN
      INSERT INTO public.application_events (application_id, actor_user_id, actor_email, event_type)
      VALUES (NEW.id, auth.uid(), v_email, 'note_updated');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER applications_log_insert
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

CREATE TRIGGER applications_log_update
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

-- Storage bucket for resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']
);

CREATE POLICY "anyone uploads resumes" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "recruiters read resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.is_recruiter_or_admin(auth.uid()));
