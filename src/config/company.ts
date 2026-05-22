// Brand + company context. To clone this app for a new company,
// edit this file (and src/config/screening.ts) — that's it.
export const company = {
  slug: "pipit",
  name: "Pipit Search Hub",
  tagline: "Business Development Manager — Healthcare",
  logoUrl: "", // optional path; falls back to initials if empty
  contactEmail: "ken@pipit.com",
  // Brand colors used as oklch overrides in src/styles.css
  // (Edit the :root --primary / --accent in styles.css to change them.)
} as const;
