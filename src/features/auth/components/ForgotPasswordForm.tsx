"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "../auth";
import { mapAuthError } from "../error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const origin = window.location.origin;
      const { error } = await sendPasswordResetEmail(
        email,
        `${origin}/auth/callback?next=/auth/reset-password`
      );

      if (error) {
        setError(mapAuthError(error.message, t));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 space-y-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{t.passwordForm.forgotTitle}</h1>
        <p className="text-[15px] text-muted-foreground">{t.passwordForm.forgotDesc}</p>
      </div>
        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                {t.passwordForm.checkEmail.replace("{email}", email)}
              </p>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
              >
                {t.passwordForm.backToLogin}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.passwordForm.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t.passwordForm.sending : t.passwordForm.sendResetLink}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t.passwordForm.rememberPassword}{" "}
              <Link
                href="/login"
                className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
              >
                {t.passwordForm.login}
              </Link>
            </div>
          </>
        )}
    </div>
  );
}
