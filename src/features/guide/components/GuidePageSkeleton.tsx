import { PageShell } from "@/components/layout/PageShell";

// Neutral skeleton mirroring GuidePage (hero, jump row, alternating steps).
export function GuidePageSkeleton() {
  return (
    <PageShell width="medium" className="py-16">
      <div className="max-w-2xl">
        <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
        <div className="mt-3 h-12 w-3/4 rounded-lg bg-muted animate-pulse" />
        <div className="mt-5 h-5 w-full max-w-lg rounded bg-muted animate-pulse" />
        <div className="mt-8 h-10 w-44 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="mt-14 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-32 shrink-0 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      <div className="mt-16 space-y-20">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className={i % 2 === 1 ? "md:order-2" : undefined}>
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              <div className="mt-5 h-7 w-56 rounded bg-muted animate-pulse" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="mx-auto h-56 w-full max-w-sm rounded-2xl bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
