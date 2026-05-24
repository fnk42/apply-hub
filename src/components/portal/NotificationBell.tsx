import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/admin.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listMyNotifications(),
    refetchInterval: 60_000,
  });

  const notifs = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  async function readOne(id: string) {
    try {
      await markNotificationRead({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    } catch {
      /* noop */
    }
  }
  async function readAll() {
    try {
      await markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    } catch {
      /* noop */
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium tabular-nums text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={readAll}
            >
              <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifs.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifs.map((n) => {
              const body = (
                <div
                  className={cn(
                    "border-b border-border px-3 py-2 last:border-b-0",
                    !n.read_at && "bg-muted/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  )}
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  to={n.link}
                  onClick={() => readOne(n.id)}
                  className="block hover:bg-muted/60"
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={n.id}
                  onClick={() => readOne(n.id)}
                  className="block w-full text-left hover:bg-muted/60"
                >
                  {body}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
