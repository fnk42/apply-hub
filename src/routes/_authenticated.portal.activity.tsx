import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listActivity } from "@/lib/candidates.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: () => listActivity({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/portal/activity")({
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQuery),
  component: ActivityPage,
});

const EVENT_LABELS: Record<string, string> = {
  created: "applied",
  manual_added: "added",
  fit_changed: "updated fit on",
  status_changed: "updated stage on",
  note_updated: "noted on",
};

function actorInitials(email: string | null) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

function ActivityPage() {
  const { data } = useSuspenseQuery(activityQuery);
  const [type, setType] = useState("all");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const events = useMemo(() => {
    return data.events.filter((e) => {
      if (type !== "all" && e.event_type !== type) return false;
      if (actor !== "all" && e.actor_email !== actor) return false;
      if (from && new Date(e.created_at) < new Date(from)) return false;
      if (to && new Date(e.created_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [data.events, type, actor, from, to]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = format(new Date(e.created_at), "EEEE, MMM d");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="font-serif text-4xl tracking-tight text-foreground">
        Activity
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Timeline of all candidate actions.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(EVENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger>
            <SelectValue placeholder="All performers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All performers</SelectItem>
            {data.actors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Start date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="End date"
        />
      </div>

      <div className="mt-8 space-y-8">
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching activity.</p>
        )}
        {grouped.map(([day, items]) => (
          <section key={day}>
            <h2 className="font-serif text-xl tracking-tight text-foreground">
              {day}
            </h2>
            <div className="mt-3 space-y-2">
              {items.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/30 text-xs font-semibold text-accent-foreground">
                    {actorInitials(ev.actor_email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ev.created_at), "EEEE, MMM d — h:mm a")}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-foreground">
                        {ev.actor_email?.split("@")[0] ?? "System"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                      </span>{" "}
                      <Link
                        to="/portal/$id"
                        params={{ id: ev.application_id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {ev.candidate_name}
                      </Link>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
