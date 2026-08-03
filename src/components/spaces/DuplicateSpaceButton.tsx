"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface DuplicateSpaceButtonProps {
  spaceId: string;
  size?: "sm" | "md";
}

export function DuplicateSpaceButton({ spaceId, size = "md" }: DuplicateSpaceButtonProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error === "INSUFFICIENT_CREDITS" ? t.space.duplicateNoCredits : (data?.error || t.space.duplicateFailed));
        return;
      }
      router.push(`/dashboard/edit-space/${data.spaceId}`);
    } finally {
      setBusy(false);
    }
  };

  const buttonSize = size === "sm" ? "sm" : "sm";

  return (
    <Button
      size={buttonSize}
      variant="outline"
      onClick={handleClick}
      disabled={busy}
      className="gap-1.5 border-border/60 hover:border-violet-500/50 transition-colors"
      title={t.space.duplicate}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{busy ? t.space.duplicating : t.space.duplicate}</span>
    </Button>
  );
}
