import { Compass } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export default function ExploreLoading() {
  return (
    <PageShell width="content">
      {/* Header — mirrors explore/page.tsx. Title/subtitle are neutral pulse
          bars, not literal text, so no English flashes before the localized
          page resolves. */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Compass className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="h-9 w-56 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="mt-2 h-6 w-72 max-w-full rounded bg-muted animate-pulse" />
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
