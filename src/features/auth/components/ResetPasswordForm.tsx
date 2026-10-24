"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasActiveSession, updateUserPassword } from "../auth";
import { mapAuthError } from "../error-messages";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

export function ResetPasswordForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    hasActiveSession().then((active) => {
      if (!active) {
        router.replace("/login");
      } else {
        setSessionReady(true);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError(t.passwordForm.passwordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordForm.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateUserPassword(newPassword);
      if (error) {
        setError(mapAuthError(error.message, t));
      } else {
        router.replace("/dashboard/contents");
        router.refresh();
      }
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="text-muted-foreground text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 space-y-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{t.passwordForm.updatePassword}</h1>
        <p className="text-[15px] text-muted-foreground">{t.passwordForm.confirmPassword}</p>
      </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t.passwordForm.newPassword}</Label>
            <PasswordInput
              id="newPassword"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t.passwordForm.confirmPassword}</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? t.passwordForm.updating : t.passwordForm.updatePassword}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
          >
            {t.passwordForm.backToLogin}
          </Link>
        </div>
    </div>
  );
}
