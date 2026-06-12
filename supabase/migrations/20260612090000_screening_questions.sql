-- Per-ad screening questions.
--
-- Replaces the hardcoded `screeningBySlug` map in src/config/screening.ts as the
-- source of truth for which questions the public apply form renders for a given
-- job ad. Answers still save as { [question.key]: value } in
-- applications.screening_answers (unchanged) -- this table only DEFINES the
-- questions.
--
-- `key` is a stable, immutable string id used as the screening_answers JSON key
-- (e.g. "healthcare_bd"). The renderer keys answers by question id, and the staff
-- candidate view labels stored answers by that same string, so we expose `key`
-- (NOT the uuid PK) as the question id. It must never change after creation, or
-- previously-collected answers would be orphaned.
CREATE TABLE public.screening_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ad_id   uuid NOT NULL REFERENCES public.job_ads(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  key         text NOT NULL,
  type        text NOT NULL
                CHECK (type IN ('text','textarea','single','multiselect')),
  label       text NOT NULL,
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  required    boolean NOT NULL DEFAULT true,
  max         integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_screening_questions_job_ad_position
  ON public.screening_questions(job_ad_id, position);

-- One stable answer-key per ad.
CREATE UNIQUE INDEX uq_screening_questions_job_ad_key
  ON public.screening_questions(job_ad_id, key);

ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;

-- Public read: the apply form is anonymous.
CREATE POLICY "anyone can read screening_questions"
  ON public.screening_questions
  FOR SELECT TO anon, authenticated
  USING (true);

-- Write: admins + recruiters only (same helper used by applications RLS).
CREATE POLICY "recruiters manage screening_questions"
  ON public.screening_questions
  FOR ALL TO authenticated
  USING (public.is_recruiter_or_admin(auth.uid()))
  WITH CHECK (public.is_recruiter_or_admin(auth.uid()));
