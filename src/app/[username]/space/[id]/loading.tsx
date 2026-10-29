import { Loader2 } from "lucide-react";

export default function SpaceLoading() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
