import { PageShell } from "@/components/layout/PageShell";

export default function WhatsAppChannelLoading() {
  return (
    <PageShell width="content">
      <div className="mb-4 h-4 w-24 rounded bg-muted animate-pulse" />
      <div className="mb-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-80 w-full rounded-xl bg-muted animate-pulse" />
        <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    </PageShell>
  );
}
