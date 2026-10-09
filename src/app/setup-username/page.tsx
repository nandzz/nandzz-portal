"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { claimSignupProfile, mapAuthError } from "@/features/auth";
import { SignupLegalNotice } from "@/features/legal/components/SignupLegalNotice";
import { safeNextPath } from "@/lib/utils";
import { AUTH_RETURN_TO_KEY } from "@/lib/layout/appShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SetupUsernamePage() {
  return (
    <Suspense>
      <SetupUsernameForm />
    </Suspense>
  );
}

function SetupUsernameForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // An in-modal flow (e.g. booking) completes the username step INSIDE its own
  // auth modal, not on this page. It records where to return in
  // AUTH_RETURN_TO_KEY right before the OAuth redirect; only such flows write
  // that marker, so its presence is the signal to bounce back — the modal there
  // detects the missing profile and opens the username step. This covers every
  // booking host (widget, agent, bare profile), not just the widget route.
  // `bouncing` hides this page's form so it's never shown in that flow.
  const [bouncing, setBouncing] = useState(false);
  useEffect(() => {
    let returnTo: string | null = null;
    try {
      returnTo = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
    } catch {
      return;
    }
    const safeReturnTo = safeNextPath(returnTo, "");
    if (safeReturnTo) {
      try {
        sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
      } catch {
        // ignore — removal is best-effort
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time redirect guard: hide this page's form while we navigate back to the modal flow
      setBouncing(true);
      router.replace(safeReturnTo);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,30}$/.test(trimmed)) {
      setError(t.setup.usernameInvalid);
      setLoading(false);
      return;
    }

    try {
      // claim_signup_profile inserts the profile AND writes the welcome-credit
      // grant in one SECURITY DEFINER call, so OAuth signups get the same
      // signup_credit_grant from app_settings that email/password signups get
      // via the handle_new_user trigger.
      const result = await claimSignupProfile({
        username: trimmed,
        displayName: displayName.trim() || null,
      });

      if (!result.ok) {
        if (result.error === "UNAUTHENTICATED") {
          router.push("/login");
          return;
        }
        if (result.error === "USERNAME_TAKEN") {
          setError(t.setup.usernameTaken);
        } else if (result.error === "INVALID_USERNAME") {
          setError(t.setup.usernameInvalid);
        } else {
          // Never surface the raw server message; map to safe localized copy.
          setError(mapAuthError(result.message, t));
        }
      } else {
        // A fresh account lands on its own public profile page. Use a full-page
        // navigation (not router.push) so the browser re-runs middleware with the
        // just-created profile + session and server-renders the profile cleanly.
        // A client-side transition here stalls on the fresh profile's RSC fetch
        // and never commits — the page just appears to "do nothing".
        window.location.assign(`/${trimmed}`);
      }
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // Bouncing back to a widget flow — render nothing so this page's form never
  // flashes; the widget's auth modal takes over.
  if (bouncing) return null;

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-100/50 blur-3xl dark:bg-violet-950/25" />
      </div>

      <Card className="w-full max-w-md shadow-xl shadow-black/5 dark:shadow-black/20 border-border/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <CardTitle className="text-2xl font-bold">{t.setup.title}</CardTitle>
          <CardDescription className="text-base">{t.setup.desc}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.setup.usernameLabel}</Label>
              <Input
                id="username"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
              <p className="text-xs text-muted-foreground">{t.setup.usernameHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">
                {t.setup.displayNameLabel}{" "}
                <span className="text-muted-foreground font-normal">
                  {t.setup.displayNameOptional}
                </span>
              </Label>
              <Input
                id="displayName"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.setup.settingUp : t.setup.getStarted}
            </Button>
            <SignupLegalNotice />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
