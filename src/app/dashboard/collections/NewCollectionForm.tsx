"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function NewCollectionForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const LIMITS = { name: 80, description: 300, descriptionLines: 5 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setLoading(true);

    if (name.length > LIMITS.name) {
      setError(t.collections.nameTooLong.replace("{n}", String(LIMITS.name)));
      setLoading(false);
      return;
    }
    if (description.length > LIMITS.description) {
      setError(t.collections.descTooLong.replace("{n}", String(LIMITS.description)));
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t.collections.mustBeLoggedIn);
      setLoading(false);
      return;
    }

    const { error: err } = await supabase.from("collections").insert({
      name: name.trim(),
      description: description.trim() || null,
      is_public: isPublic,
      user_id: user.id,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setName("");
    setDescription("");
    setLoading(false);
    router.refresh();
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-violet-600" />
          {t.collections.newCollection}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">{t.collections.nameLabel} *</Label>
              <span className="text-xs text-muted-foreground">{name.length}/{LIMITS.name}</span>
            </div>
            <Input
              id="name"
              placeholder={t.collections.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, LIMITS.name))}
              maxLength={LIMITS.name}
              required
              className="bg-muted/50 border-border/60"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">{t.collections.descLabel}</Label>
              <span className={`text-xs ${description.length >= LIMITS.description ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/{LIMITS.description}
              </span>
            </div>
            <Textarea
              id="description"
              placeholder={t.collections.descPlaceholder}
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                if (val.split("\n").length > LIMITS.descriptionLines) return;
                if (val.length > LIMITS.description) return;
                setDescription(val);
              }}
              rows={3}
              className="bg-muted/50 border-border/60 text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-violet-600"
            />
            <Label htmlFor="isPublic" className="font-normal cursor-pointer text-sm">
              {t.collections.makePublic}
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full"
          >
            {loading ? t.collections.creating : t.collections.create}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
