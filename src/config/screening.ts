// Screening questions for the public apply form.
// Add / remove / reorder freely — answers are stored as
// { [question.id]: value } in applications.screening_answers (jsonb),
// so changing questions never requires a database migration.

export type ScreeningQuestion =
  | {
      id: string;
      type: "text";
      label: string;
      required: boolean;
      max: number;
      placeholder?: string;
    }
  | {
      id: string;
      type: "single";
      label: string;
      required: boolean;
      options: string[];
    }
  | {
      id: string;
      type: "multiselect";
      label: string;
      required: boolean;
      options: string[];
    };

// Screening questions keyed by job-ad slug. Answers are stored as
// { [question.id]: value } in applications.screening_answers (jsonb),
// so changing questions never requires a database migration.
//
// To add a role: add a new slug entry below. No other code changes needed.
// (Future: this map is the seam that will later read from a per-ad DB column.)
export const screeningBySlug: Record<string, ScreeningQuestion[]> = {
  // MP Shah — Business Development Manager (senior). 167 live applicants.
  // DO NOT EDIT — must stay exactly as originally served.
  "business-development-manager": [
    {
      id: "healthcare_bd",
      type: "text",
      required: true,
      max: 300,
      label:
        "Have you worked in business development within the healthcare industry? If yes, briefly describe the setting (hospital, insurance, pharma, medical devices, etc.).",
    },
    {
      id: "b2b_closed",
      type: "text",
      required: true,
      max: 500,
      label:
        "Describe a B2B account you personally prospected and closed. What was the approximate annual value?",
    },
    {
      id: "client_segments",
      type: "multiselect",
      required: true,
      label:
        "Which of the following client segments have you managed relationships with? Select all that apply.",
      options: [
        "Doctors/Medical professionals",
        "Insurance companies",
        "Corporate clients",
        "Government/public sector",
      ],
    },
    {
      id: "team_size",
      type: "single",
      required: true,
      label: "How many people have you directly managed in a sales or BD team?",
      options: ["None", "1–3", "4–7", "8+"],
    },
  ],

  // Infinity Tech — junior/entry-level (senior-sounding title).
  // Questions deliberately do NOT screen out low/no formal experience.
  "business-development-customer-service-executive": [
    {
      id: "relevant_experience",
      type: "text",
      required: true,
      max: 300,
      label:
        "Tell us about any experience you have in sales, customer service, client support, or business development. This can include internships, part-time work, attachments, campus, or volunteer roles. If you don't have direct experience yet, tell us why you'd be good at this role.",
    },
    {
      id: "customer_instinct",
      type: "text",
      required: true,
      max: 400,
      label:
        "This role is about finding new clients and keeping existing ones happy. Tell us about a time you persuaded someone, helped a customer, or built a good relationship — in any setting. What did you do, and what was the result?",
    },
    {
      id: "tech_comfort",
      type: "single",
      required: true,
      label:
        "How would you describe your comfort with technology and digital tools (spreadsheets, CRM, online communication)?",
      options: [
        "Very comfortable, I learn tools quickly",
        "Fairly comfortable",
        "Basic, but willing to learn",
      ],
    },
  ],
};

// Shown for any ad whose slug isn't mapped above.
export const defaultScreening: ScreeningQuestion[] = [];

export function screeningQuestionsFor(slug: string): ScreeningQuestion[] {
  return screeningBySlug[slug] ?? defaultScreening;
}
