
# Pipit Apply — Build Plan

Goal: a public apply page + private recruiter portal you can clone per company, with manual entry, fit rating, pipeline status, notes, and activity log. Built in Lovable in **3 prompts**, then handed to Claude Code for polish.

## Architecture for cloneability

One config file drives the brand and the company context:

```
src/config/company.ts
  export const company = {
    slug: "pipit",
    name: "Pipit Search Hub",
    logoUrl: "/logo.svg",
    primary: "#0F1C2E",
    accent:  "#F5A623",
    contactEmail: "ken@pipit.com",
  }
```

Screening questions also live in config so they can be swapped per role/company without touching forms or schema:

```
src/config/screening.ts
  export const screeningQuestions = [
    { id: "healthcare_bd", type: "text",   required: true, max: 300,
      label: "Have you worked in business development within the healthcare industry? If yes, briefly describe the setting (hospital, insurance, pharma, medical devices, etc.)." },
    { id: "b2b_closed",    type: "text",   required: true, max: 500,
      label: "Describe a B2B account you personally prospected and closed. What was the approximate annual value?" },
    { id: "client_segments", type: "multiselect", required: true,
      label: "Which of the following client segments have you managed relationships with? Select all that apply.",
      options: ["Doctors/Medical professionals","Insurance companies","Corporate clients","Government/public sector"] },
    { id: "team_size", type: "single", required: true,
      label: "How many people have you directly managed in a sales or BD team?",
      options: ["None","1–3","4–7","8+"] },
  ]
```

Answers stored in a single `screening_answers jsonb` column on `applications` — schema doesn't change when questions do.

To reuse for another company: remix → edit `company.ts` + `screening.ts` → swap logo.

## Data model (Lovable Cloud / Supabase)

```text
applications
  id uuid pk
  created_at timestamptz default now()
  updated_at timestamptz (trigger)
  source text                -- 'public_form' | 'manual'
  full_name text not null
  email text not null
  phone text not null
  linkedin_url text not null
  resume_url text not null   -- storage path in 'resumes' bucket
  cover_note text
  screening_answers jsonb not null default '{}'::jsonb
  fit text default 'unrated' -- 'unrated'|'weak'|'medium'|'strong'
  pipeline_status text default 'sourced'
    -- 'sourced'|'scheduled_interview'|'rejected_screening'|'candidate_declined'
  recruiter_notes text
  honeypot text              -- spam trap, must be empty

application_events  (activity log)
  id, application_id, created_at, actor_email, event_type, from_value, to_value
  -- event_type: 'created'|'fit_changed'|'status_changed'|'note_updated'|'manual_added'

user_roles
  user_id uuid, role app_role  -- 'admin'|'recruiter'
```

For manual-add via portal, `phone`, `linkedin_url`, `resume_url`, and `screening_answers` are NOT required at the DB level — recruiters often add candidates with partial info. The NOT NULL constraints apply only to the public form path, enforced by Zod client-side. (Manual inserts pass empty strings / `{}`.)

RLS:
- `applications`: anon INSERT only. Recruiters/admins SELECT/UPDATE all (via `has_role()`).
- `application_events`: insert by trigger or authenticated recruiter; SELECT for recruiters.
- Storage bucket `resumes`: anon upload (PDF/DOCX, 10MB cap), recruiter read via signed URLs.

Triggers auto-write `application_events` rows on insert and on fit/status/note changes.

## Routes

- `/` — public apply page (branded via `company.ts`, questions from `screening.ts`)
- `/portal/login` — recruiter login (email/password + Google)
- `/portal` — candidates table (filters: status, fit; search by name/email)
- `/portal/new` — manual add candidate
- `/portal/:id` — candidate detail: profile, resume link, screening answers, fit, status, notes, activity log

Protected via `_authenticated` layout + `requireSupabaseAuth` server fns.

## Public form fields (all required except cover note)

Full name · Email · Phone · LinkedIn URL · Resume (PDF/DOCX, 10MB) · Cover note (optional, 500 char) · 4 screening questions · hidden honeypot.

Render screening questions by mapping over `screeningQuestions` — adding a question later = edit one array.

---

## Prompt 1 — Public apply page + Cloud schema

> Enable Lovable Cloud. Create `applications` (with `screening_answers jsonb`, phone/linkedin/resume_url NOT NULL), `application_events`, `user_roles`, `app_role` enum, `has_role()` security-definer fn, RLS policies (anon insert on applications + resumes bucket; authenticated full access via `has_role`), and trigger logging created/fit_changed/status_changed/note_updated into `application_events`. Create private `resumes` storage bucket, 10MB, PDF/DOCX only.
>
> Create `src/config/company.ts` ({slug, name, logoUrl, primary, accent, contactEmail}) and `src/config/screening.ts` (array of question definitions: text / single / multiselect, with required + max). Wire brand colors into CSS tokens in `src/styles.css`.
>
> Build `/` as the public apply page: full name, email, phone, LinkedIn URL, resume upload, cover note (optional, 500 char), honeypot, plus screening questions rendered dynamically from `screening.ts`. Make ALL fields except cover note required. Validate with Zod (schema built from the screening config). On submit: upload to `resumes/{uuid}-{filename}`, insert applications row with source=`public_form` and `screening_answers` as a `{question_id: value}` jsonb. Show success state. Branded header with `company.name` / `company.logoUrl`.

## Prompt 2 — Auth + recruiter portal (list, detail, manual add)

> Add email/password + Google auth. `_authenticated` layout redirects to `/portal/login`. Build:
> - `/portal/login`
> - `/portal` candidates table — columns: name, email, source, fit badge, pipeline status badge, created_at. Filters: status, fit, search. Row click → detail.
> - `/portal/new` — manual add: same fields, but only name+email required at the form level (everything else optional for manual entries), source=`manual`. Optional inline fit + status on creation.
> - `/portal/:id` — detail page with: contact info, signed resume URL (if any), screening answers rendered from `screening.ts` config (label + answer), inline-editable fit (radio: weak/medium/strong/unrated), pipeline status dropdown (sourced/scheduled_interview/rejected_screening/candidate_declined), recruiter notes textarea (auto-save on blur), and activity log timeline below (newest first, actor + change + timestamp).
>
> All recruiter mutations via `createServerFn` with `requireSupabaseAuth`. New signups get `recruiter` role by default via trigger on `auth.users`.

## Prompt 3 — Polish + multi-tenant hardening

> Add `/portal/settings` (admin only) for inviting recruiters by email. Add CSV export on `/portal` (include screening answer columns). Add empty states + loading skeletons. Make sure every page reads brand from `company.ts` and questions from `screening.ts`.
>
> Write a README at repo root: (1) how to clone for a new company (remix → edit `company.ts` + `screening.ts` → swap logo → optionally remix Cloud backend), (2) env vars, (3) schema, (4) what's left for Claude Code.

---

## Handoff to Claude Code

Push to GitHub, open in Claude Code:

1. **Email notifications** — Resend → `company.contactEmail` on new application.
2. **Server-side validation + rate limiting** — move public submit to `/api/public/applications` TanStack server route, IP throttle + honeypot check before DB insert.
3. **Untitled UI token alignment** with Pipit Search Hub.
4. **Bulk actions** on candidates table.
5. **Audit hardening** — capture IP / user-agent into `application_events` on public submit.
6. **Per-tenant Cloud isolation script** — `scripts/clone-for-tenant.ts` that scaffolds a fresh Supabase project + re-applies migration.

## Why this shape

- 3 prompts because each one is a coherent, testable slice.
- `company.ts` + `screening.ts` + CSS tokens = cloning is a 2-file change.
- `screening_answers jsonb` means changing/adding questions never requires a migration.
- Activity log via DB triggers — works no matter where the change comes from.
- Roles in a separate table (mandatory security pattern).
- Public submit goes direct to Supabase in Lovable; Claude Code moves it behind a server route later for rate limiting. Same RLS, non-breaking migration.
