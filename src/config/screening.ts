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

export const screeningQuestions: ScreeningQuestion[] = [
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
    label:
      "How many people have you directly managed in a sales or BD team?",
    options: ["None", "1–3", "4–7", "8+"],
  },
];
