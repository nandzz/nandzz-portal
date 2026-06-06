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
import { useLanguage } from "@/contexts/LanguageContext";

interface SpaceOwnerMenuProps {
  spaceId: string;
  editHref: string;
  redirectTo: string;
}

export function SpaceOwnerMenu({ spaceId, editHref, redirectTo }: SpaceOwnerMenuProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(t.space.confirmDelete)) return;
    const supabase = createClient();
    await deleteSpaceWithCleanup(supabase, spaceId);
    router.push(redirectTo);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label={t.space.spaceActions}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(editHref)}>
          <Pencil className="h-4 w-4" />
          {t.space.edit}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/analytics/${spaceId}`)}>
          <BarChart2 className="h-4 w-4" />
          {t.space.analytics}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          {t.space.deleteSpace}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
