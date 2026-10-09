// Neutral skeleton mirroring the widget settings page (back link, header,
// settings card). Overrides the parent booking-workspace skeleton, whose
// tabs/grid layout doesn't match this page.
export default function BookingSettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 h-4 w-32 rounded bg-muted animate-pulse" />
      <div className="mb-8 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border border-border/60 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-6 w-11 rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
