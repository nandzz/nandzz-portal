// Neutral skeleton mirroring the booking workspace layout (header + tabs row +
// content block). No copy — the real page owns all localized text.
export default function BookingLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header: icon + title/subtitle on the left, controls on the right. */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
          <div>
            <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
            <div className="mt-2 h-4 w-56 max-w-full rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Tabs row. */}
      <div className="mb-6 flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded bg-muted animate-pulse" />
        ))}
      </div>

      {/* Content block. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="mt-3 h-64 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
