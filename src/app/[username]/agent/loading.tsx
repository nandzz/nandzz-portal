import { PageShell } from "@/components/layout/PageShell";

export default function AgentLoading() {
  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <PageShell width="content">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="mt-8 space-y-4">
          <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      </PageShell>
    </div>
  );
}
