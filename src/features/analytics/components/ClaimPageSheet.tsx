"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  checkUsernameAvailability,
  type UsernameAvailability,
} from "@/features/auth/actions/check-username";
import { savePendingUsername } from "@/features/auth/lib/pending-username";

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;
const CHECK_DEBOUNCE_MS = 350;

type Status = "idle" | "checking" | UsernameAvailability;

// Keep only what a username can hold, as the visitor types.
function sanitize(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
}

/**
 * Linktree-style "claim your page" sheet, opened from the visitor CTA pill on
 * someone's profile. The visitor picks their `nandzz.com/<name>` first (live
 * availability check), then continues to the normal signup; the chosen name is
 * carried through (see pending-username) and pre-fills the username step.
 *
 * Bottom sheet on phones, centered card from md up.
 */
export function ClaimPageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const c = t.claimPage;

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(0);

  // Escape to close + lock the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Debounced availability check; stale responses are dropped via requestId.
  useEffect(() => {
    const id = ++requestId.current;
    if (!name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the debounced input; reset when cleared
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(name)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(name).catch(
        () => "available" as const
      );
      if (id === requestId.current) setStatus(result);
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name]);

  if (!open) return null;

  const canSubmit = status === "available" && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    savePendingUsername(name);
    router.push("/login?tab=signup");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-page-title"
        className={cn(
          "relative z-10 w-full overflow-clip bg-violet-600 text-white shadow-2xl",
          "rounded-t-[2rem] px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]",
          "animate-in slide-in-from-bottom duration-300 ease-out motion-reduce:animate-none",
          "md:mx-4 md:max-w-md md:rounded-[2rem] md:pb-8 md:slide-in-from-bottom-0 md:zoom-in-95 md:fade-in"
        )}
      >
        {/* Soft glow for depth on the flat brand surface. Clipped by its own
            wrapper: if it overflowed the panel itself, focusing the input would
            scroll the (overflow-hidden) panel sideways. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-400/40 blur-3xl" />
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <Link href="/" className="flex items-center text-lg font-bold tracking-tight" onClick={onClose}>
            <span>nand</span>
            <span className="text-violet-200">zz</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={c.close}
            className="-mr-2 -mt-1 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-6">
          <h2
            id="claim-page-title"
            className="text-[2.1rem] font-bold leading-[1.05] tracking-tight text-balance"
          >
            {c.titleLead} <span className="text-violet-200">{c.titleAccent}</span>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-violet-100">{c.desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="relative mt-6">
          <label
            className={cn(
              "flex h-14 items-center rounded-2xl bg-white px-4 text-base text-zinc-900 ring-2 ring-transparent transition-shadow focus-within:ring-white/60",
              (status === "taken" || status === "invalid") && "ring-rose-300"
            )}
          >
            <span className="shrink-0 text-zinc-500">nandzz.com/</span>
            <input
              value={name}
              onChange={(e) => setName(sanitize(e.target.value))}
              placeholder={c.placeholder}
              aria-label={c.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-zinc-400"
            />
            <StatusIcon status={status} />
          </label>

          <p aria-live="polite" className="mt-2 min-h-5 px-1 text-sm font-medium">
            {status === "checking" && <span className="text-violet-100">{c.checking}</span>}
            {status === "available" && <span className="text-emerald-200">{c.available}</span>}
            {status === "taken" && <span className="text-rose-200">{c.taken}</span>}
            {status === "invalid" && <span className="text-rose-200">{c.invalid}</span>}
          </p>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-base font-semibold text-white shadow-lg transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {c.cta}
          </button>
        </form>

        <div className="relative mt-6 flex flex-col gap-2 text-sm">
          <p className="text-violet-100">
            {c.haveAccount}{" "}
            <Link href="/login" onClick={onClose} className="font-semibold text-white underline underline-offset-4">
              {c.login}
            </Link>
          </p>
          <Link href="/" onClick={onClose} className="text-violet-100 underline underline-offset-4 hover:text-white">
            {c.learnMore}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "checking")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" aria-hidden />;
  if (status === "available")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-4 w-4" aria-hidden />
      </span>
    );
  if (status === "taken" || status === "invalid")
    return <X className="h-5 w-5 shrink-0 text-rose-500" aria-hidden />;
  return null;
}
