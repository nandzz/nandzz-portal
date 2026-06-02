"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, BarChart2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { deleteSpaceWithCleanup } from "@/lib/delete-space";

interface SpaceOwnerMenuProps {
  spaceId: string;
  editHref: string;
  redirectTo: string;
}

export function SpaceOwnerMenu({ spaceId, editHref, redirectTo }: SpaceOwnerMenuProps) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this space? This cannot be undone.")) return;
    const supabase = createClient();
    await deleteSpaceWithCleanup(supabase, spaceId);
    router.push(redirectTo);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label="Space actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(editHref)}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/analytics/${spaceId}`)}>
          <BarChart2 className="h-4 w-4" />
          Analytics
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
