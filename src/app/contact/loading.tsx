// Neutral skeleton mirroring the contact page (centered title + form).
export default function ContactLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 flex flex-col items-center">
        <div className="h-9 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="mt-3 h-5 w-72 max-w-full rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-32 w-full rounded-md bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}
