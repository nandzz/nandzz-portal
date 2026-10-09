// Neutral skeleton mirroring the analytics layout (header, visitors card,
// stat cards, chart). Without it, tapping the Analytics tab kept the previous
// page — and its chrome colors — on screen until the queries finished.
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header: back + title on the left, period control on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-px bg-border" />
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Profile visitors. */}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-3 w-56 rounded bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex gap-10">
            <div className="h-10 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        </div>
      </section>

      {/* Content stats. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}
