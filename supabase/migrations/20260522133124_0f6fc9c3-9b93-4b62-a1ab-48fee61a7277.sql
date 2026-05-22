
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS shortlisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_title text;
