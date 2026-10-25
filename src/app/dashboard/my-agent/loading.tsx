import { PageShell } from "@/components/layout/PageShell";

export default function MyAgentLoading() {
  return (
    <PageShell width="content">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-muted animate-pulse" />
          <div className="h-4 w-52 rounded bg-muted animate-pulse" />
        </div>
      </div>
      {/* Connect banner */}
      <div className="mb-6 h-16 w-full rounded-xl bg-muted animate-pulse" />
      {/* Tabs */}
      <div className="mb-6 h-9 w-full max-w-xl rounded-lg bg-muted animate-pulse" />
      {/* Feed rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </PageShell>
  );
}
