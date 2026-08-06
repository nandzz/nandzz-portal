"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Collection } from "@/lib/types";

interface CollectionActionsProps {
  collection: Collection;
}

export function CollectionActions({ collection }: CollectionActionsProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [isPublic, setIsPublic] = useState(collection.is_public);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from("collections")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        is_public: isPublic,
      })
      .eq("id", collection.id);
    setSaving(false);
    setEditOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete collection "${collection.name}"? Content won't be deleted.`)) return;
    await supabase.from("collections").delete().eq("id", collection.id);
    router.push("/dashboard/collections");
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/dashboard/create-space?collectionId=${collection.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-violet-400/60 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 gap-1.5")}
        >
          <Plus className="h-3.5 w-3.5" />
          New Content
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="border-border/60 gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="border-border/60 text-destructive hover:text-destructive hover:border-destructive/50 gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Collection">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted/50 border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-muted/50 border-border/60 text-sm"
            />
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50">
            <input
              type="checkbox"
              id="edit-isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-violet-600"
            />
            <Label htmlFor="edit-isPublic" className="font-normal cursor-pointer text-sm">
              Make this collection public
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
              className="border-border/60"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
