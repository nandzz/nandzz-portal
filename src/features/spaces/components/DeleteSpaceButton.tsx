"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSpace } from "../actions/delete-space";

interface DeleteSpaceButtonProps {
  spaceId: string;
  redirectTo: string;
}

export function DeleteSpaceButton({ spaceId, redirectTo }: DeleteSpaceButtonProps) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this content? This cannot be undone.")) return;
    // deleteSpace revalidates server-side; a refresh() here would cancel the push.
    await deleteSpace({ id: spaceId });
    router.push(redirectTo);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      onClick={handleDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
