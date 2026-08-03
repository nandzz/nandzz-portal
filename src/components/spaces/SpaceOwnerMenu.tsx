"use client";

import { useState } from "react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    const supabase = createClient();
    await deleteSpaceWithCleanup(supabase, spaceId);
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={t.space.spaceActions}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-max">
          <DropdownMenuItem onClick={() => router.push(editHref)}>
            <Pencil className="h-4 w-4" />
            {t.space.edit}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/analytics/${spaceId}`)}>
            <BarChart2 className="h-4 w-4" />
            {t.space.analytics}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" />
            {t.space.deleteSpace}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t.space.deleteSpace}
        description={t.space.confirmDelete}
        confirmLabel={t.space.deleteSpace}
        cancelLabel={t.space.cancel}
      />
    </>
  );
}
