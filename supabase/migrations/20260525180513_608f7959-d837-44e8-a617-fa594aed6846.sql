-- 1. Slugify helper (idempotent)
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
             '-+', '-', 'g'
           )
         );
$$;

-- 2. clients.slug column (nullable for now so existing rows can be backfilled)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS slug text;

-- 3. Trigger that fills clients.slug on insert / when nulled, ensuring uniqueness
CREATE OR REPLACE FUNCTION public.set_client_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_candidate text;
  v_suffix int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  v_base := nullif(public.slugify(NEW.name), '');
  IF v_base IS NULL THEN
    v_base := 'client';
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.clients
    WHERE slug = v_candidate
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix::text;
  END LOOP;

  NEW.slug := v_candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_slug ON public.clients;
CREATE TRIGGER trg_set_client_slug
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_slug();

-- 4. Backfill existing rows (deterministic order so collisions resolve predictably)
DO $$
DECLARE
  r record;
  v_base text;
  v_candidate text;
  v_suffix int;
BEGIN
  FOR r IN
    SELECT id, name FROM public.clients WHERE slug IS NULL OR slug = '' ORDER BY created_at, id
  LOOP
    v_base := nullif(public.slugify(r.name), '');
    IF v_base IS NULL THEN v_base := 'client'; END IF;
    v_candidate := v_base;
    v_suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.clients WHERE slug = v_candidate AND id <> r.id
    ) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix::text;
    END LOOP;
    UPDATE public.clients SET slug = v_candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Lock the column down once backfilled
ALTER TABLE public.clients
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_slug_key ON public.clients (slug);

-- 6. job_ads.archived_at (additive, nullable)
ALTER TABLE public.job_ads
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS job_ads_archived_at_idx
  ON public.job_ads (archived_at)
  WHERE archived_at IS NOT NULL;
