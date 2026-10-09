"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { signOutUser } from "../auth";
import { getLegalUi } from "@/features/legal/i18n";

// Danger-zone account deletion, extracted from the settings page. The actual
// deletion stays a real HTTP endpoint (`DELETE /api/account/delete`) because it
// must run under the admin client to remove the auth user — behavior preserved.
// The sign-out afterwards mutates the live browser session, so it goes through
// the client-side `signOutUser` wrapper (never `@/lib/supabase/*` directly, per
// the feature guardrail).
export function DeleteAccount({ username }: { username: string }) {
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setDeleteError(body.error || "Failed to delete account");
        return;
      }
      await signOutUser();
      router.push("/");
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-destructive">{t.settings.deleteAccountTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.settings.deleteAccountDesc}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setDeleteDialogOpen(true);
              setDeleteConfirm("");
              setDeleteError("");
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t.settings.deleteAccountButton}
          </Button>
        </div>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title={t.settings.deleteDialogTitle}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {(() => {
              const [before, after] = t.settings.deleteDialogDesc.split("{username}");
              return <>{before}<span className="font-mono font-semibold text-foreground">{username}</span>{after}</>;
            })()}
          </p>
          <p className="text-sm text-muted-foreground">{getLegalUi(locale).deleteConsequences}</p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={username}
            className="w-full rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-sm focus:border-destructive/50 focus:outline-none focus:ring-1 focus:ring-destructive/30"
          />
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              {t.settings.deleteDialogCancel}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirm !== username || deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? t.settings.deleting : t.settings.deleteDialogConfirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
