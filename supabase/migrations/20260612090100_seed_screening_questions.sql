-- Seed screening_questions from the existing hardcoded screeningBySlug map
-- (src/config/screening.ts) so no live questions are lost when the apply form
-- switches to reading from the database.
--
-- Idempotent: matches each ad by slug and skips rows whose (job_ad_id, key)
-- already exists. Safe to re-run. If an ad's slug isn't present, its block
-- inserts nothing.
--
-- `key` MUST match the existing string ids in screeningBySlug exactly, because
-- the 167 live applicants on the BD-manager ad have screening_answers keyed by
-- these strings.

-- MP Shah -- Business Development Manager (senior).
INSERT INTO public.screening_questions
  (job_ad_id, position, key, type, label, options, required, max)
SELECT ja.id, q.position, q.key, q.type, q.label, q.options, q.required, q.max
FROM public.job_ads ja
CROSS JOIN (VALUES
  (1, 'healthcare_bd', 'text',
   $q$Have you worked in business development within the healthcare industry? If yes, briefly describe the setting (hospital, insurance, pharma, medical devices, etc.).$q$,
   '[]'::jsonb, true, 300),
  (2, 'b2b_closed', 'text',
   $q$Describe a B2B account you personally prospected and closed. What was the approximate annual value?$q$,
   '[]'::jsonb, true, 500),
  (3, 'client_segments', 'multiselect',
   $q$Which of the following client segments have you managed relationships with? Select all that apply.$q$,
   '["Doctors/Medical professionals","Insurance companies","Corporate clients","Government/public sector"]'::jsonb,
   true, NULL),
  (4, 'team_size', 'single',
   $q$How many people have you directly managed in a sales or BD team?$q$,
   '["None","1–3","4–7","8+"]'::jsonb, true, NULL)
) AS q(position, key, type, label, options, required, max)
WHERE ja.slug = 'business-development-manager'
ON CONFLICT (job_ad_id, key) DO NOTHING;

-- Infinity Tech -- junior/entry-level.
INSERT INTO public.screening_questions
  (job_ad_id, position, key, type, label, options, required, max)
SELECT ja.id, q.position, q.key, q.type, q.label, q.options, q.required, q.max
FROM public.job_ads ja
CROSS JOIN (VALUES
  (1, 'relevant_experience', 'text',
   $q$Tell us about any experience you have in sales, customer service, client support, or business development. This can include internships, part-time work, attachments, campus, or volunteer roles. If you don't have direct experience yet, tell us why you'd be good at this role.$q$,
   '[]'::jsonb, true, 300),
  (2, 'customer_instinct', 'text',
   $q$This role is about finding new clients and keeping existing ones happy. Tell us about a time you persuaded someone, helped a customer, or built a good relationship — in any setting. What did you do, and what was the result?$q$,
   '[]'::jsonb, true, 400),
  (3, 'tech_comfort', 'single',
   $q$How would you describe your comfort with technology and digital tools (spreadsheets, CRM, online communication)?$q$,
   '["Very comfortable, I learn tools quickly","Fairly comfortable","Basic, but willing to learn"]'::jsonb,
   true, NULL)
) AS q(position, key, type, label, options, required, max)
WHERE ja.slug = 'business-development-customer-service-executive'
ON CONFLICT (job_ad_id, key) DO NOTHING;
