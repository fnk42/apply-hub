ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS years_of_experience integer,
  ADD COLUMN IF NOT EXISTS current_company text;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_yoe_range CHECK (years_of_experience IS NULL OR (years_of_experience >= 0 AND years_of_experience <= 60)),
  ADD CONSTRAINT applications_current_company_len CHECK (current_company IS NULL OR char_length(current_company) <= 160);