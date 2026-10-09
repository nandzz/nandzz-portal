import { Loader2 } from "lucide-react";

// This route only redirects to /<username>/space/<id>; match that viewer's
// loading state so the hop reads as one transition.
export default function SpaceRedirectLoading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
