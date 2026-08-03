"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddToCollectionDialog } from "@/components/collections/AddToCollectionDialog";
import { cn } from "@/lib/utils";

interface StarButtonProps {
  spaceId: string;
  spaceTitle?: string;
  initialSaved?: boolean;
  size?: "sm" | "md";
  onToggle?: (saved: boolean) => void;
}

export function StarButton({
  spaceId,
  spaceTitle = "",
  initialSaved = false,
  size = "sm",
  onToggle,
}: StarButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setDialogOpen(true);
  };

  const handleSavedChange = (inAnyCollection: boolean) => {
    setSaved(inAnyCollection);
    onToggle?.(inAnyCollection);
    startTransition(() => {
      router.refresh();
    });
  };

  const iconSize = size === "sm" ? "size-3.5" : "size-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        title={saved ? "Manage collections" : "Save to collection"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition-colors hover:text-violet-500",
          textSize,
          saved ? "text-violet-500" : "text-muted-foreground"
        )}
      >
        <Bookmark className={cn(iconSize, saved && "fill-violet-500")} />
      </button>

      <AddToCollectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        spaceId={spaceId}
        spaceTitle={spaceTitle}
        onSavedChange={handleSavedChange}
      />
    </>
  );
}
