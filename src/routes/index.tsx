import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listLiveJobAds } from "@/lib/candidates.functions";
import { company } from "@/config/company";
import { Briefcase, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const liveAdsQuery = queryOptions({
  queryKey: ["live-job-ads"],
  queryFn: () => listLiveJobAds(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(liveAdsQuery),
  head: () => ({
    meta: [
      { title: `Open roles — ${company.name}` },
      {
        name: "description",
        content: `Open roles at ${company.name}. Apply directly.`,
      },
      { property: "og:title", content: `Open roles — ${company.name}` },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(liveAdsQuery);
  const ads = data.ads;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {company.name}
          </p>
          <h1 className="mt-2 font-serif text-5xl tracking-tight">
            Open roles
          </h1>
          <p className="mt-3 text-muted-foreground">
            Active searches we&apos;re currently running. Click a role to apply.
          </p>
        </header>

        {ads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <p className="text-muted-foreground">
              No open roles right now. Check back soon.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ads.map((a) => (
              <li key={a.id}>
                <Link
                  to="/apply/$slug"
                  params={{ slug: a.slug }}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition hover:border-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" />
                      {a.client_name ?? "Direct hire"}
                      {a.start_date && (
                        <span>
                          · Start {format(new Date(a.start_date), "MMM yyyy")}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-serif text-2xl tracking-tight">
                      {a.title}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
