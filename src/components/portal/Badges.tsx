import { cn } from "@/lib/utils";

export const FIT_LABELS: Record<string, string> = {
  unrated: "Unrated",
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

export const STATUS_LABELS: Record<string, string> = {
  sourced: "Sourced",
  scheduled_interview: "Scheduled for Interview",
  hired: "Hired",
  rejected_screening: "Rejected at Screening",
  candidate_declined: "Candidate Declined",
};

// Shared stage color map keyed by legacy_status. Used by chips, funnel, and
// other stage rendering surfaces. Custom user-added stages fall back to neutral.
export const STAGE_BADGE_STYLES: Record<string, string> = {
  sourced: "bg-slate-100 text-slate-700",
  scheduled_interview: "bg-blue-100 text-blue-800",
  hired: "bg-emerald-100 text-emerald-800",
  rejected_screening: "bg-rose-100 text-rose-800",
  candidate_declined: "bg-amber-100 text-amber-800",
};

export const STAGE_BAR_COLORS: Record<string, string> = {
  sourced: "bg-slate-400",
  scheduled_interview: "bg-blue-500",
  hired: "bg-emerald-500",
  rejected_screening: "bg-rose-500",
  candidate_declined: "bg-amber-500",
};

export function stageBadgeClass(legacyStatus?: string | null) {
  if (!legacyStatus) return "bg-muted text-muted-foreground";
  return STAGE_BADGE_STYLES[legacyStatus] ?? "bg-muted text-muted-foreground";
}

export function FitBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    unrated: "bg-muted text-muted-foreground",
    weak: "bg-destructive/15 text-destructive",
    medium: "bg-accent/30 text-accent-foreground",
    strong: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[value] || styles.unrated,
      )}
    >
      {FIT_LABELS[value] ?? value}
    </span>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        stageBadgeClass(value),
      )}
    >
      {STATUS_LABELS[value] ?? value}
    </span>
  );
}
