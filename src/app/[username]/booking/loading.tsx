// Commits the navigation the instant "Book now" is tapped, so the whole page
// (content + status bar, which ThemeColorSync reverts on tap) switches to the
// booking page's colors together instead of the bar flipping first while the
// profile lingers until the server render lands.
export default function BookingLoading() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* Floating controls — back + share */}
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-5">
        <div className="h-9 w-9 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="h-9 w-9 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>

      {/* Hero — avatar, name, widget pill */}
      <header className="mx-auto flex max-w-lg flex-col items-center px-4 pt-6">
        <div className="h-20 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="mt-4 h-7 w-44 max-w-[80vw] rounded bg-muted motion-safe:animate-pulse" />
        <div className="mt-2 h-6 w-36 rounded-full bg-muted motion-safe:animate-pulse" />
      </header>

      {/* Booking card — heading + service rows */}
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
          <div className="mt-2 h-4 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl border border-border/60 bg-muted/40 motion-safe:animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
