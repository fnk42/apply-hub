import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  accent?: "green" | "blue" | "amber" | "purple" | "rose" | "slate";
  delta?: { current: number; previous: number; suffix?: string };
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  green: "border-l-emerald-500",
  blue: "border-l-blue-500",
  amber: "border-l-amber-500",
  purple: "border-l-violet-500",
  rose: "border-l-rose-500",
  slate: "border-l-slate-400",
};

export function StatCard({ label, value, accent = "slate", delta }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border border-l-4 bg-card p-5 shadow-sm",
        accentClasses[accent],
      )}
    >
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-serif text-4xl tracking-tight text-foreground">
        {value}
      </div>
      {delta && <DeltaPill {...delta} />}
    </div>
  );
}

function DeltaPill({
  current,
  previous,
  suffix = "vs last week",
}: {
  current: number;
  previous: number;
  suffix?: string;
}) {
  let pct: number;
  let dir: "up" | "down" | "flat";
  if (previous === 0 && current === 0) {
    pct = 0;
    dir = "flat";
  } else if (previous === 0) {
    pct = 100;
    dir = "up";
  } else {
    pct = Math.round(((current - previous) / previous) * 100);
    dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  }
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : ArrowRight;
  const color =
    dir === "up"
      ? "text-emerald-600"
      : dir === "down"
        ? "text-rose-600"
        : "text-muted-foreground";
  return (
    <div className={cn("mt-3 flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3 w-3" />
      <span>
        {Math.abs(pct)}% {suffix}
      </span>
    </div>
  );
}
