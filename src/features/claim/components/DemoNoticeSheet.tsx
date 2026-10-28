"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { demoNotice, useDemoNotice } from "../lib/demo-notice-store";

const SUPPORT_EMAIL = "support@nandzz.com";
const SEEN_KEY = "nandzz-demo-notice-seen:";

// Codes are NDZ-XXXXX-XXXXX; keep what a code can hold, as the visitor types.
function sanitize(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

/**
 * Opens as soon as a visitor lands on a demo profile (admin-built pitch page):
 * warns the content may not match the business and offers the claim path —
 * enter the activation code (→ /claim?code=…) or request one by email.
 * Opens by itself once per browser session per demo, so moving between the
 * profile's sub-pages doesn't re-open it; after that the visitor pill's
 * "Demo page" chip reopens it (see demo-notice-store).
 *
 * Same look as ClaimPageSheet: bottom sheet on phones, centered card from md up.
 */
export function DemoNoticeSheet({ username }: { username: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const c = t.demoNotice;

  const { open } = useDemoNotice();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Register this page as a demo (the visitor pill reads it) and open on
  // arrival unless already dismissed this session.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY + username) === "1";
    } catch {}
    demoNotice.register(username, !seen);
    return () => demoNotice.unregister();
  }, [username]);

  const close = () => {
    demoNotice.close();
    try {
      sessionStorage.setItem(SEEN_KEY + username, "1");
    } catch {}
  };

  // Escape to close + lock the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only touches state + storage
  }, [open]);

  if (!open) return null;

  const canSubmit = code.replace(/-/g, "").length >= 3 && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    router.push(`/claim?code=${encodeURIComponent(code)}`);
  };

  const requestHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    c.requestSubject.replace("{username}", username)
  )}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-notice-title"
        className={cn(
          "relative z-10 w-full overflow-clip bg-violet-600 text-white shadow-2xl",
          "rounded-t-[2rem] px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]",
          "animate-in slide-in-from-bottom duration-300 ease-out motion-reduce:animate-none",
          "md:mx-4 md:max-w-md md:rounded-[2rem] md:pb-8 md:slide-in-from-bottom-0 md:zoom-in-95 md:fade-in"
        )}
      >
        {/* Soft glow, clipped by its own wrapper (see ClaimPageSheet). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-400/40 blur-3xl" />
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center text-lg font-bold tracking-tight" onClick={close}>
              <span>nand</span>
              <span className="text-violet-200">zz</span>
            </Link>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {c.badge}
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={c.close}
            className="-mr-2 -mt-1 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-6">
          <h2
            id="demo-notice-title"
            className="text-[2.1rem] font-bold leading-[1.05] tracking-tight text-balance"
          >
            {c.titleLead} <span className="text-violet-200">{c.titleAccent}</span>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-violet-100">{c.desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="relative mt-6">
          <label className="flex h-14 items-center rounded-2xl bg-white px-4 text-base text-zinc-900 ring-2 ring-transparent transition-shadow focus-within:ring-white/60">
            <input
              value={code}
              onChange={(e) => setCode(sanitize(e.target.value))}
              placeholder={c.codePlaceholder}
              aria-label={c.codePlaceholder}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent font-mono font-medium tracking-wider outline-none placeholder:font-normal placeholder:text-zinc-400"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-base font-semibold text-white shadow-lg transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {c.cta}
          </button>
        </form>

        <div className="relative mt-6 flex flex-col gap-2 text-sm">
          <p className="text-violet-100">
            {c.noCode}{" "}
            <a href={requestHref} className="font-semibold text-white underline underline-offset-4">
              {c.requestCode}
            </a>
          </p>
          <button
            type="button"
            onClick={close}
            className="self-start text-violet-100 underline underline-offset-4 hover:text-white"
          >
            {c.explore}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
