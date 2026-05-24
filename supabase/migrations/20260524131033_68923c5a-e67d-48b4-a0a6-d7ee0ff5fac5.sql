
-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ad_id uuid NOT NULL REFERENCES public.job_ads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  triggered_by text NOT NULL DEFAULT 'manual',
  notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "clients read own paid payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client')
    AND status = 'paid'
    AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payments_client ON public.payments(client_id);
CREATE INDEX idx_payments_job ON public.payments(job_ad_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "system inserts notifications" ON public.notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at);

-- DEFAULT FEE SETTING
INSERT INTO public.app_settings (key, value)
VALUES ('default_posting_fee_cents', '50000'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- BILLING TRIGGER on 10th application
CREATE OR REPLACE FUNCTION public.maybe_trigger_billing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.job_ads%ROWTYPE;
  v_count integer;
  v_fee integer;
BEGIN
  SELECT * INTO v_job FROM public.job_ads WHERE id = NEW.job_ad_id;
  IF v_job.id IS NULL OR NOT v_job.is_billable OR v_job.billing_triggered_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.applications WHERE job_ad_id = NEW.job_ad_id;
  IF v_count < 10 THEN RETURN NEW; END IF;
  v_fee := COALESCE(v_job.posting_fee_cents, 0);
  IF v_fee = 0 THEN
    SELECT (value)::text::integer INTO v_fee FROM public.app_settings WHERE key = 'default_posting_fee_cents';
    v_fee := COALESCE(v_fee, 50000);
  END IF;
  INSERT INTO public.payments (job_ad_id, client_id, amount_cents, status, triggered_by, notes)
  VALUES (v_job.id, v_job.client_id, v_fee, 'pending', 'auto_10_candidates',
          'Auto-created: 10 candidates threshold reached');
  UPDATE public.job_ads SET billing_triggered_at = now() WHERE id = v_job.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maybe_trigger_billing
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.maybe_trigger_billing();

-- DEFAULT POSTING FEE on new billable job_ads
CREATE OR REPLACE FUNCTION public.set_default_posting_fee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fee integer;
BEGIN
  IF NEW.is_billable AND NEW.posting_fee_cents IS NULL THEN
    SELECT (value)::text::integer INTO v_fee FROM public.app_settings WHERE key = 'default_posting_fee_cents';
    NEW.posting_fee_cents := COALESCE(v_fee, 50000);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_default_posting_fee
  BEFORE INSERT ON public.job_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_default_posting_fee();

-- PHASE 6: recruiter -> member
UPDATE public.user_roles SET role = 'member' WHERE role = 'recruiter';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_recruiter_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','member'))
$$;

DROP POLICY IF EXISTS "recruiters and members read job_ads" ON public.job_ads;
CREATE POLICY "internal read job_ads" ON public.job_ads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'member'));

DROP POLICY IF EXISTS "recruiters and members read job_ad_stages" ON public.job_ad_stages;
CREATE POLICY "internal read job_ad_stages" ON public.job_ad_stages
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'member'));
