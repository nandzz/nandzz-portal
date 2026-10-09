// Neutral skeleton mirroring the hashtag page (icon + title, count, grid).
export default function HashtagLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="mt-2 h-6 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-video rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
