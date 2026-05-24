
-- 1. job_ad_stages table
CREATE TABLE public.job_ad_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ad_id uuid NOT NULL REFERENCES public.job_ads(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL,
  legacy_status text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_ad_id, position)
);

CREATE INDEX idx_job_ad_stages_job_ad ON public.job_ad_stages(job_ad_id, position);

ALTER TABLE public.job_ad_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage job_ad_stages" ON public.job_ad_stages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "recruiters and members read job_ad_stages" ON public.job_ad_stages
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'member'::app_role));

CREATE TRIGGER set_job_ad_stages_updated_at
  BEFORE UPDATE ON public.job_ad_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Seed-default-stages trigger
CREATE OR REPLACE FUNCTION public.seed_default_job_ad_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_ad_stages (job_ad_id, label, position, legacy_status, is_default) VALUES
    (NEW.id, 'Sourced', 1, 'sourced', true),
    (NEW.id, 'Scheduled for Interview', 2, 'scheduled_interview', true),
    (NEW.id, 'Rejected at Screening', 3, 'rejected_screening', true),
    (NEW.id, 'Candidate Declined', 4, 'candidate_declined', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_default_stages_on_job_ad_insert
  AFTER INSERT ON public.job_ads
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_job_ad_stages();

-- 3. Backfill stages for existing ads
INSERT INTO public.job_ad_stages (job_ad_id, label, position, legacy_status, is_default)
SELECT j.id, v.label, v.position, v.legacy_status, true
FROM public.job_ads j
CROSS JOIN (VALUES
  ('Sourced', 1, 'sourced'),
  ('Scheduled for Interview', 2, 'scheduled_interview'),
  ('Rejected at Screening', 3, 'rejected_screening'),
  ('Candidate Declined', 4, 'candidate_declined')
) AS v(label, position, legacy_status);

-- 4. Add stage_id to applications + backfill
ALTER TABLE public.applications
  ADD COLUMN stage_id uuid REFERENCES public.job_ad_stages(id) ON DELETE SET NULL;

CREATE INDEX idx_applications_stage_id ON public.applications(stage_id);

UPDATE public.applications a
SET stage_id = s.id
FROM public.job_ad_stages s
WHERE s.job_ad_id = a.job_ad_id
  AND s.legacy_status = a.pipeline_status;
