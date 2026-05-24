
-- 1. Rename columns to whole-KES units
ALTER TABLE public.job_ads RENAME COLUMN posting_fee_cents TO posting_fee;
ALTER TABLE public.payments RENAME COLUMN amount_cents TO amount;

-- Convert existing values from cents to whole units (existing fee was meant as 35000 not 3500000;
-- but the existing record has NULL so this is safe either way)
UPDATE public.payments SET amount = (amount / 100)::int WHERE amount IS NOT NULL AND amount >= 100;

-- 2. Currency default to KES
ALTER TABLE public.payments ALTER COLUMN currency SET DEFAULT 'kes';
UPDATE public.payments SET currency = 'kes';

-- 3. Replace app_settings key default_posting_fee_cents with default_posting_fee (whole KES, 35000)
DELETE FROM public.app_settings WHERE key = 'default_posting_fee_cents';
INSERT INTO public.app_settings (key, value)
VALUES ('default_posting_fee', to_jsonb(35000))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 4. Update triggers to use new column names and new setting key
CREATE OR REPLACE FUNCTION public.maybe_trigger_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_fee := COALESCE(v_job.posting_fee, 0);
  IF v_fee = 0 THEN
    SELECT (value)::text::integer INTO v_fee FROM public.app_settings WHERE key = 'default_posting_fee';
    v_fee := COALESCE(v_fee, 35000);
  END IF;
  INSERT INTO public.payments (job_ad_id, client_id, amount, currency, status, triggered_by, notes)
  VALUES (v_job.id, v_job.client_id, v_fee, 'kes', 'pending', 'auto_10_candidates',
          'Auto-created: 10 candidates threshold reached');
  UPDATE public.job_ads SET billing_triggered_at = now() WHERE id = v_job.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_default_posting_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_fee integer;
BEGIN
  IF NEW.is_billable AND NEW.posting_fee IS NULL THEN
    SELECT (value)::text::integer INTO v_fee FROM public.app_settings WHERE key = 'default_posting_fee';
    NEW.posting_fee := COALESCE(v_fee, 35000);
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Update Business Manager: pending, billable, 35000 KES
UPDATE public.job_ads
SET status = 'pending_authorization',
    is_billable = true,
    posting_fee = 35000,
    authorized_at = NULL,
    authorized_by = NULL
WHERE slug = 'business-manager';
