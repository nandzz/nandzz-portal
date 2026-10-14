"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { AuthForm } from "@/features/auth";
import { signOutUser } from "@/features/auth/auth";
import { SignupLegalNotice } from "@/features/legal/components/SignupLegalNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { claimDemoProfile } from "../actions/claim-demo-profile";

export type ClaimState = "anon" | "ready" | "has-profile";

// /claim — a business redeems the activation code for the demo profile we
// built for them. Three states, decided server-side:
// - anon: sign in / sign up first (no username step — the demo IS the profile)
// - ready: signed in without a profile → enter the code
// - has-profile: this account already owns a profile → can't claim
export function ClaimFlow({
  state,
  initialCode,
  email,
}: {
  state: ClaimState;
  initialCode: string;
  email: string | null;
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
      const res = await claimDemoProfile(code.trim());
      if (!res.ok) {
        if (res.error === "INVALID_CODE") setError(t.claim.invalidCode);
        else if (res.error === "ALREADY_HAS_PROFILE") setError(t.claim.alreadyHasProfile);
        else if (res.error === "UNAUTHENTICATED") router.refresh();
        else setError(t.claim.failed);
        return;
      }
      setDone(true);
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
            <p className="text-center text-sm font-medium">{t.claim.signInFirst}</p>
            <AuthForm
              variant="embedded"
              defaultMode="signup"
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

        {state === "has-profile" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{t.claim.alreadyHasProfile}</p>
            {email && <p className="text-xs text-muted-foreground">{t.claim.signedInAs.replace("{email}", email)}</p>}
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              {t.claim.signOut}
            </Button>
          </div>
        )}

        {state === "ready" && (
          <form onSubmit={handleClaim} className="space-y-4">
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
              {loading ? t.claim.claiming : t.claim.claimButton}
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
