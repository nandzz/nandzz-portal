import { PageShell } from "@/components/layout/PageShell";

// Neutral bars only (no copy) — matches LegalPage's frame so there's no layout
// jump when the document streams in.
export function LegalPageSkeleton() {
  return (
    <PageShell width="narrow" className="py-16">
      <div className="mb-8 flex flex-wrap gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-16 rounded bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-9 w-72 max-w-full rounded bg-muted animate-pulse" />
      <div className="mt-4 h-5 w-full max-w-lg rounded bg-muted animate-pulse" />
      <div className="mt-3 h-4 w-48 rounded bg-muted animate-pulse" />
      <div className="mt-10 space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-56 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
