import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export default function SubscribedLoading() {
  return (
    <PageShell width="content">
      {/* Header — mirrors dashboard/credits/SubscriptionView.tsx. */}
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <div className="h-8 w-40 rounded-lg bg-muted animate-pulse" />
          <div className="mt-2 h-5 w-64 max-w-full rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Current plan card */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-8 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Plan chooser */}
      <div className="mb-10">
        <div className="mb-4 h-6 w-20 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              <div className="h-8 w-24 rounded bg-muted animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-4 w-full rounded bg-muted animate-pulse" />
                ))}
              </div>
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Credit balances */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
        <div className="mb-3 h-3 w-20 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>

      {/* Activity */}
      <div className="mb-4 h-6 w-24 rounded bg-muted animate-pulse" />
      <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/30">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
