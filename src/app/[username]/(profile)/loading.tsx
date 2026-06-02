export default function ProfileLoading() {
  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Background: violet blur circle like the real no-cover state */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Profile header skeleton — centered, matching ProfileHeader layout */}
        <div className="flex flex-col items-center text-center">
          <div className="h-28 w-28 rounded-full bg-muted animate-pulse border-4 border-background shadow-xl" />
          <div className="mt-5 h-7 w-44 max-w-[80vw] rounded bg-muted animate-pulse" />
          <div className="mt-1.5 h-4 w-28 max-w-[60vw] rounded bg-muted animate-pulse" />
          <div className="mt-2 h-4 w-52 max-w-[75vw] rounded bg-muted animate-pulse" />
          <div className="mt-3 space-y-2 flex flex-col items-center w-full px-4">
            <div className="h-4 w-72 max-w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-56 max-w-[90%] rounded bg-muted animate-pulse" />
          </div>
          <div className="mt-5 flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="mt-12">
          <div className="flex gap-4 border-b border-border/60 mb-8">
            <div className="h-8 w-20 rounded bg-muted animate-pulse" />
            <div className="h-8 w-24 rounded bg-muted animate-pulse" />
          </div>

          {/* Space grid skeleton */}
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
        </div>
      </div>
    </div>
  );
}
