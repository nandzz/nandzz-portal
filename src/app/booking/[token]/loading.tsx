// Neutral skeleton mirroring the manage-booking card.
export default function ManageBookingLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-44 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
        </div>
        <div className="mt-6 flex gap-3">
          <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
          <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
