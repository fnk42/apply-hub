import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

interface Event {
  id: string;
  application_id: string;
  candidate_name: string;
  actor_email: string | null;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

function actorInitials(email: string | null) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

function verbFor(type: string) {
  switch (type) {
    case "created":
      return "applied";
    case "manual_added":
      return "added";
    case "fit_changed":
      return "updated fit on";
    case "status_changed":
      return "updated stage on";
    case "note_updated":
      return "noted on";
    default:
      return type;
  }
}

export function RecentActivity({ events }: { events: Event[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-2xl tracking-tight">Recent Activity</h2>
      <div className="mt-6 space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          events.map((ev) => {
            const actor = ev.actor_email?.split("@")[0] ?? "System";
            const when = formatDistanceToNow(new Date(ev.created_at), {
              addSuffix: true,
            });
            return (
              <div key={ev.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/30 text-xs font-semibold text-accent-foreground">
                  {actorInitials(ev.actor_email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">{actor}</span>{" "}
                    <span className="text-muted-foreground">{verbFor(ev.event_type)}</span>{" "}
                    <Link
                      to="/portal/$id"
                      params={{ id: ev.application_id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {ev.candidate_name}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
