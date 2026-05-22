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
  rejected_screening: "Rejected at Screening",
  candidate_declined: "Candidate Declined",
};

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
  const styles: Record<string, string> = {
    sourced: "bg-muted text-muted-foreground",
    scheduled_interview: "bg-blue-100 text-blue-800",
    rejected_screening: "bg-destructive/15 text-destructive",
    candidate_declined: "bg-orange-100 text-orange-800",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[value] || styles.sourced,
      )}
    >
      {STATUS_LABELS[value] ?? value}
    </span>
  );
}
