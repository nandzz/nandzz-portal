import { PageShell } from "@/components/layout/PageShell";

export default function CollectionDetailLoading() {
  return (
    <PageShell width="content">
      {/* Back link */}
      <div className="h-4 w-28 rounded bg-muted animate-pulse mb-8" />

      <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          </div>
          <div className="mt-2 h-5 w-72 rounded bg-muted animate-pulse" />
          <div className="mt-1 h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-md bg-muted animate-pulse" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
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
