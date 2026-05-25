import { Link } from "@tanstack/react-router";

interface Item {
  id: string;
  name: string;
  openRoles: number;
}

export function TopClientsChart({ items }: { items: Item[] }) {
  const max = Math.max(1, ...items.map((i) => i.openRoles));
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-2xl tracking-tight">Top clients by open roles</h2>
      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No live roles yet.</p>
        ) : (
          items.map((it) => {
            const pct = Math.round((it.openRoles / max) * 100);
            return (
              <div key={it.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <Link
                    to="/main/clients/$id"
                    params={{ id: it.id }}
                    className="font-medium text-foreground hover:underline"
                  >
                    {it.name}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">
                    {it.openRoles} {it.openRoles === 1 ? "role" : "roles"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
