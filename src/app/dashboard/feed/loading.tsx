import { Rss } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export default function FeedLoading() {
  return (
    <PageShell width="content">
      {/* Header — mirrors dashboard/feed/page.tsx. */}
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
          <Rss className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <div className="h-8 w-28 rounded-lg bg-muted animate-pulse" />
          <div className="mt-2 h-5 w-56 max-w-full rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 overflow-hidden"
          >
            <div className="aspect-[16/10] bg-muted animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
