import { cn } from "@/lib/utils";
import { STAGE_BAR_COLORS } from "@/components/portal/Badges";

interface Stage {
  key: string;
  label: string;
  count: number;
}

export function PipelineFunnel({ stages }: { stages: Stage[] }) {
  const total = Math.max(
    stages.reduce((s, x) => s + x.count, 0),
    1,
  );
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-2xl tracking-tight">Pipeline Funnel</h2>
      <div className="mt-6 space-y-5">
        {stages.map((s) => {
          const pct = Math.round((s.count / total) * 100);
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.count} · {pct}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    stageColor[s.key] ?? "bg-slate-400",
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
