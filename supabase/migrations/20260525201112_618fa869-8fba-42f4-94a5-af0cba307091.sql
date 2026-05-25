-- Add "Hired" as a default pipeline stage
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
    (NEW.id, 'Hired', 3, 'hired', true),
    (NEW.id, 'Rejected at Screening', 4, 'rejected_screening', true),
    (NEW.id, 'Candidate Declined', 5, 'candidate_declined', true);
  RETURN NEW;
END;
$$;

-- Backfill: add Hired stage to existing job ads that don't have it
INSERT INTO public.job_ad_stages (job_ad_id, label, position, legacy_status, is_default)
SELECT j.id, 'Hired',
  COALESCE((SELECT MAX(position) FROM public.job_ad_stages s WHERE s.job_ad_id = j.id), 0) + 1,
  'hired', true
FROM public.job_ads j
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_ad_stages s
  WHERE s.job_ad_id = j.id AND s.legacy_status = 'hired'
);