"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Plus, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Collection {
  id: string;
  name: string;
}

interface AddToCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  spaceTitle: string;
}

export function AddToCollectionDialog({
  open,
  onClose,
  spaceId,
  spaceTitle,
}: AddToCollectionDialogProps) {
  const { t } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: cols }, { data: memberships }] = await Promise.all([
        supabase
          .from("collections")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("collection_spaces")
          .select("collection_id")
          .eq("space_id", spaceId),
      ]);

      setCollections(cols || []);
      const ids = new Set((memberships || []).map((m) => m.collection_id));
      setMemberOf(ids);
      setPending(new Set(ids));
      setLoading(false);
    };

    load();
  }, [open, spaceId, supabase]);

  const toggle = (id: string) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const toAdd = [...pending].filter((id) => !memberOf.has(id));
    const toRemove = [...memberOf].filter((id) => !pending.has(id));

    if (toAdd.length > 0) {
      await supabase.from("collection_spaces").insert(
        toAdd.map((collection_id) => ({ collection_id, space_id: spaceId }))
      );
    }

    for (const collection_id of toRemove) {
      await supabase
        .from("collection_spaces")
        .delete()
        .eq("collection_id", collection_id)
        .eq("space_id", spaceId);
    }
    setSaving(false);
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("collections")
      .insert({ name: newName.trim(), user_id: user.id })
      .select("id, name")
      .single();

    if (data) {
      setCollections((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setPending((prev) => new Set([...prev, data.id]));
    }
    setNewName("");
    setCreating(false);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t.addCollection.title}>
      <p className="text-sm text-muted-foreground mb-4 -mt-1 truncate">
        {spaceTitle}
      </p>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t.addCollection.loading}
        </div>
      ) : (
        <div className="space-y-4">
          {collections.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {t.addCollection.noCollections}
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {collections.map((col) => {
                const checked = pending.has(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggle(col.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <div
                      className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        checked
                          ? "bg-violet-600 border-violet-600"
                          : "border-border/60"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="truncate">{col.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* New collection inline */}
          <div className="border-t border-border/50 pt-3">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t.addCollection.newLabel}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={t.addCollection.namePlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                className="bg-muted/50 border-border/60 text-sm h-8"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="h-8 px-2.5 border-border/60"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-border/60"
            >
              {t.addCollection.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t.addCollection.saving : t.addCollection.save}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
