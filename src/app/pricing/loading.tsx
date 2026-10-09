// Neutral skeleton mirroring the pricing layout (centered hero + plan cards).
export default function PricingLoading() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 h-8 w-40 rounded-full bg-muted animate-pulse" />
        <div className="mx-auto h-12 w-full max-w-xl rounded-lg bg-muted animate-pulse" />
        <div className="mx-auto mt-4 h-5 w-full max-w-md rounded bg-muted animate-pulse" />
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl border border-border/60 bg-card p-8">
            <div className="h-6 w-24 rounded bg-muted animate-pulse" />
            <div className="mt-4 h-10 w-32 rounded bg-muted animate-pulse" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 w-full rounded bg-muted animate-pulse" />
              ))}
            </div>
            <div className="mt-8 h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
