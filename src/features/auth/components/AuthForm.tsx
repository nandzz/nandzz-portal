"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithPassword,
  signUpWithEmail,
  signInWithGoogle,
} from "../auth";
import { claimSignupProfile } from "../actions/claim-signup-profile";
import { SignupLegalNotice } from "@/features/legal/components/SignupLegalNotice";
import { mapAuthError } from "../error-messages";
import { safeNextPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, MailCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// The outcome of a successful email/password auth, handed to `onSuccess` so an
// embedded caller (e.g. the booking widget) can react in place instead of
// navigating away. Google is a full-page redirect and cannot report here.
export type AuthResult = {
  mode: "login" | "signup";
  email: string;
  displayName: string;
};

/**
 * The single sign-in / sign-up form used across the app — full-page on
 * `/login`, and embedded inside a modal wherever auth is asked for mid-flow
 * (see `AuthModal`). One component so every entry point stays identical:
 * same fields, same Google button, same validation.
 *
 * - `variant="page"` (default): renders inside a Card and, on success,
 *   navigates to `next` — today's behavior, unchanged.
 * - `variant="embedded"`: drops the Card chrome (the modal supplies the shell)
 *   and, when `onSuccess` is given, reports the result instead of navigating.
 * - `googleRedirectTo`: where Google returns to (defaults to
 *   `/auth/callback?next=…`); embedded callers point it back at their own page.
 */
// The three views this form can show. "setup" is the choose-a-username step an
// OAuth signup lands on once it has a session but no profile row yet — kept here
// (not on a separate page) so callers can complete onboarding in place.
type Mode = "login" | "signup" | "setup";

export function AuthForm({
  variant = "page",
  onSuccess,
  onGoogleRedirect,
  googleRedirectTo,
  subtitle,
  defaultMode,
  ctaLabel,
  initialDisplayName,
}: {
  variant?: "page" | "embedded";
  onSuccess?: (result: AuthResult) => void;
  // Fired right before Google navigates away — a chance for embedded callers to
  // persist in-progress state (e.g. a booking) so it survives the OAuth round
  // trip and can be restored when the visitor returns.
  onGoogleRedirect?: () => void;
  googleRedirectTo?: string;
  subtitle?: string;
  defaultMode?: Mode;
  // Overrides the primary button label in the "setup" step, so the CTA can read
  // in the caller's terms (e.g. "Continue booking" instead of "Get started").
  ctaLabel?: string;
  // Seeds the display-name field (e.g. the name Google returned) so the setup
  // step arrives pre-filled.
  initialDisplayName?: string;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode =
    defaultMode ?? (searchParams.get("tab") === "signup" ? "signup" : "login");
  // Restrict to a same-origin path — this value is echoed back through
  // Supabase's OAuth redirectTo and could otherwise be used for an open
  // redirect (see safeNextPath).
  const next = safeNextPath(searchParams.get("next"), "/dashboard/contents");

  const [mode, setMode] = useState<Mode>(initialMode);
  const { t } = useLanguage();

  useEffect(() => {
    // Page mode syncs to the ?tab= URL param; embedded/explicit-mode callers own
    // their default and shouldn't be overridden by the host page's query string.
    if (defaultMode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the mode to the ?tab= URL param when the query string changes (external-state sync, not derived render state)
    setMode(searchParams.get("tab") === "signup" ? "signup" : "login");
  }, [searchParams, defaultMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when email-confirmation is on and signup returns no session: the form is
  // replaced by a "check your email" panel. Confirming the link returns via
  // `emailRedirectTo` → /auth/callback → the username setup step.
  const [confirmSent, setConfirmSent] = useState(false);

  // Where Google returns after OAuth. Embedded callers override this to come
  // back to their own page; page mode keeps the /auth/callback → next flow.
  const googleTarget = () =>
    googleRedirectTo ??
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Navigate (page mode) or hand the result back (embedded with onSuccess).
  // `destination` overrides where page mode lands — a fresh signup goes to the
  // new user's profile ("/<username>"), while login falls back to `next`. The
  // profile destination uses a full-page navigation so the browser re-runs
  // middleware with the just-created profile + session and server-renders it
  // cleanly; a client-side transition to a brand-new profile route can stall on
  // its first RSC fetch and never commit.
  const finishSuccess = (result: AuthResult, destination?: string) => {
    if (onSuccess) {
      onSuccess(result);
      return;
    }
    if (destination) {
      window.location.assign(destination);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    onGoogleRedirect?.();
    const { error } = await signInWithGoogle(googleTarget());
    if (error) {
      setError(mapAuthError(error.message, t));
      setLoading(false);
    }
  };

  // Completes an OAuth signup: claims the chosen username/profile, then reports
  // success so an embedded caller can carry on (page mode navigates to `next`).
  const handleSetup = async (e: React.FormEvent) => {
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
      const result = await claimSignupProfile({
        username: trimmed,
        displayName: displayName.trim() || null,
      });
      if (!result.ok) {
        if (result.error === "USERNAME_TAKEN") setError(t.setup.usernameTaken);
        else if (result.error === "INVALID_USERNAME") setError(t.setup.usernameInvalid);
        else if (result.error === "UNAUTHENTICATED") setError(t.common.error);
        // Never surface the raw server message; map to safe localized copy.
        else setError(mapAuthError(result.message, t));
        return;
      }
      // A fresh signup lands on the new user's own profile page; embedded callers
      // (booking) ignore the destination and continue in place via onSuccess.
      finishSuccess(
        { mode: "signup", email, displayName: displayName.trim() },
        `/${trimmed}`
      );
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        // Confirm the two password entries match before creating the account —
        // email signup only (Google never reaches this branch).
        if (password !== confirmPassword) {
          setError(t.auth.passwordMismatch);
          setLoading(false);
          return;
        }
        // Step 1 of signup: create the account with email + password only. The
        // username is chosen next, in the shared "setup" step — the same step
        // Google signups complete — so both methods finish onboarding identically
        // and (in a modal) never leave it.
        const { error, hasSession } = await signUpWithEmail({
          email,
          password,
          // Where the confirmation link returns — same target Google uses, so
          // /auth/callback picks up the session and routes to the username step.
          emailRedirectTo: googleTarget(),
        });

        if (error) {
          setError(mapAuthError(error.message, t));
        } else if (hasSession) {
          setMode("setup");
        } else {
          // No session means email confirmation is enabled: the account exists
          // but must be confirmed before a session (and the username step) can
          // follow. Show the "check your email" panel instead of stalling.
          setConfirmSent(true);
        }
      } else {
        const { error } = await signInWithPassword(email, password);

        if (error) {
          setError(mapAuthError(error.message, t));
        } else {
          finishSuccess({ mode: "login", email, displayName: "" });
        }
      }
    } catch {
      setError(t.authErrors.generic);
    } finally {
      setLoading(false);
    }
  };

  const title = confirmSent
    ? t.auth.checkEmailTitle
    : mode === "setup"
    ? t.setup.title
    : mode === "login"
    ? t.auth.welcomeBack
    : t.auth.createAccount;
  const description = confirmSent
    ? t.auth.checkEmailDesc.replace("{email}", email)
    : mode === "setup"
    ? t.setup.desc
    : subtitle ??
      (mode === "login" ? t.auth.loginDesc : t.auth.signupDesc);

  // The choose-a-username step (OAuth signup completion). No Google button, no
  // login/signup toggle — the visitor is already authenticated and only needs a
  // username to finish. The primary CTA label is overridable (`ctaLabel`) so it
  // can speak the caller's flow (e.g. "Continue booking").
  const setupBody = (
    <form onSubmit={handleSetup} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="setup-username">{t.setup.usernameLabel}</Label>
        <Input
          id="setup-username"
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
        <Label htmlFor="setup-displayName">
          {t.setup.displayNameLabel}{" "}
          <span className="text-muted-foreground font-normal">
            {t.setup.displayNameOptional}
          </span>
        </Label>
        <Input
          id="setup-displayName"
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
        {loading ? t.setup.settingUp : ctaLabel ?? t.setup.getStarted}
      </Button>
      <SignupLegalNotice />
    </form>
  );

  // Shown after an email signup when confirmation is required: the account
  // exists but is inactive until the link is clicked. No form to submit here —
  // confirming returns via emailRedirectTo → /auth/callback → username setup.
  const confirmBody = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <p className="text-sm text-green-700 dark:text-green-400">
          {t.auth.checkEmailDesc.replace("{email}", email)}
        </p>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => {
            setConfirmSent(false);
            setMode("login");
            setError("");
          }}
          className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
        >
          {t.auth.login}
        </button>
      </div>
    </div>
  );

  const formBody = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Signup collects only email + password here; the username is chosen in
            the following "setup" step (shared with Google signups). */}
        <div className="space-y-2">
          <Label htmlFor="email">{t.auth.email}</Label>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t.auth.password}</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline transition-colors"
              >
                {t.auth.forgotPassword}
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
          />
        </div>
        {/* Confirm-password only on signup; login and OAuth never need it. */}
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t.auth.loading : mode === "login" ? t.auth.login : t.auth.signup}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t.auth.or}</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <GoogleIcon />
        <span className="ml-2">{t.auth.continueGoogle}</span>
      </Button>

      {mode === "signup" && (
        <div className="mt-4">
          <SignupLegalNotice />
        </div>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            {t.auth.noAccount}{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
            >
              {t.auth.signup}
            </button>
          </>
        ) : (
          <>
            {t.auth.hasAccount}{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:underline font-medium transition-colors"
            >
              {t.auth.login}
            </button>
          </>
        )}
      </div>
    </>
  );

  // Embedded: no Card chrome — the modal (or host) supplies the shell. A compact
  // heading still renders here so it tracks the login/signup toggle.
  if (variant === "embedded") {
    return (
      <div className="w-full">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {confirmSent ? confirmBody : mode === "setup" ? setupBody : formBody}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
          <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {confirmSent ? confirmBody : mode === "setup" ? setupBody : formBody}
      </CardContent>
    </Card>
  );
}
