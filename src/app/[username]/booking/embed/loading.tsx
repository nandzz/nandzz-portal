// Overrides the full-page booking skeleton (hero + back/share) from the parent
// segment: inside a business's website only the booking card should show.
export default function BookingEmbedLoading() {
  return (
    <div className="p-1">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
        <div className="mt-2 h-4 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl border border-border/60 bg-muted/40 motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
