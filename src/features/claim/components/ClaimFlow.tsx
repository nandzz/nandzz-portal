"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MailCheck } from "lucide-react";
import { AuthForm } from "@/features/auth";
import { signOutUser } from "@/features/auth/auth";
import { SignupLegalNotice } from "@/features/legal/components/SignupLegalNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { claimDemoProfile } from "../actions/claim-demo-profile";

const PENDING_CLAIM_COOKIE = "nandzz-pending-claim";

export type ClaimState = "anon" | "ready" | "has-profile";

// /claim — a business redeems the activation code for the demo profile we
// built for them. Three states, decided server-side:
// - anon: sign in / sign up first (no username step — the demo IS the profile)
// - ready: signed in without a profile → enter the code
// - has-profile: this account already owns a profile (typically a business
//   that signed up through the normal flow mid-claim) → can still claim: the
//   demo takes over that profile, keeping the account, plan and own content
export function ClaimFlow({
  state,
  initialCode,
  email,
  username,
  emailConfirmed,
}: {
  state: ClaimState;
  initialCode: string;
  email: string | null;
  username: string | null;
  // Back from an email-confirmation link that couldn't sign them in (opened in
  // another browser/app) — the email IS confirmed, so ask them to log in.
  emailConfirmed: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Google + email-confirmation return here (via /auth/callback, which skips
  // the username step for /claim) with the code still in the URL.
  const claimPath = initialCode ? `/claim?code=${encodeURIComponent(initialCode)}` : "/claim";

  // Remember the code across the signup detour (email confirmation, Google)
  // so the proxy can bring a profile-less visitor back here — see proxy.ts.
  useEffect(() => {
    if (!initialCode) return;
    document.cookie = `${PENDING_CLAIM_COOKIE}=${encodeURIComponent(initialCode)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }, [initialCode]);

  const handleSignOut = async () => {
    await signOutUser();
    router.refresh();
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError(t.claim.invalidCode);
      return;
    }
    setLoading(true);
    try {
      const res = await claimDemoProfile(code.trim(), state === "has-profile");
      if (!res.ok) {
        if (res.error === "INVALID_CODE") setError(t.claim.invalidCode);
        else if (res.error === "ALREADY_HAS_PROFILE") router.refresh();
        else if (res.error === "WIDGET_CONFLICT") setError(t.claim.widgetConflict);
        else if (res.error === "UNAUTHENTICATED") router.refresh();
        else setError(t.claim.failed);
        return;
      }
      setDone(true);
      document.cookie = `${PENDING_CLAIM_COOKIE}=; path=/; max-age=0; samesite=lax`;
      // Full navigation so middleware + layout re-read the brand-new profile.
      window.location.assign("/dashboard/contents");
    } catch {
      setError(t.claim.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">{t.claim.title}</CardTitle>
        <CardDescription>{t.claim.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {state === "anon" && (
          <div className="space-y-4">
            {emailConfirmed ? (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/30">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-400">{t.claim.emailConfirmed}</p>
              </div>
            ) : (
              <p className="text-center text-sm font-medium">{t.claim.signInFirst}</p>
            )}
            <AuthForm
              variant="embedded"
              defaultMode={emailConfirmed ? "login" : "signup"}
              skipUsernameStep
              googleRedirectTo={
                typeof window !== "undefined"
                  ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(claimPath)}`
                  : undefined
              }
              onSuccess={() => router.refresh()}
            />
          </div>
        )}

        {(state === "ready" || state === "has-profile") && (
          <form onSubmit={handleClaim} className="space-y-4">
            {state === "has-profile" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                {t.claim.mergeNotice.replace("{username}", username ?? "")}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="claim-code">{t.claim.codeLabel}</Label>
              <Input
                id="claim-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t.claim.codePlaceholder}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                className="text-center font-mono tracking-widest"
                disabled={loading || done}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {done && <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.claim.success}</p>}
            <Button type="submit" className="w-full" disabled={loading || done}>
              {loading ? t.claim.claiming : state === "has-profile" ? t.claim.mergeButton : t.claim.claimButton}
            </Button>
            <SignupLegalNotice />
            {email && (
              <p className="text-center text-xs text-muted-foreground">
                {t.claim.signedInAs.replace("{email}", email)} ·{" "}
                <button type="button" onClick={handleSignOut} className="underline underline-offset-2 hover:text-foreground">
                  {t.claim.signOut}
                </button>
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
