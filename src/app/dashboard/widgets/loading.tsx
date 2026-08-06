import { Blocks } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export default function WidgetsLoading() {
  return (
    <PageShell width="content">
      {/* Header — mirrors dashboard/widgets/page.tsx. */}
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          <Blocks className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <div className="h-9 w-44 rounded-lg bg-muted animate-pulse" />
          <div className="mt-2 h-5 w-64 max-w-full rounded bg-muted animate-pulse" />
        </div>
      </div>

      <div className="mb-3 h-4 w-28 rounded bg-muted animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="h-5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
