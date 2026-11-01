"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Coins,
  Database,
  EyeOff,
  Lightbulb,
  Scale,
  Store,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY } from "@/features/legal/company";
import { demoNotice, useDemoNotice } from "../lib/demo-notice-store";

// One icon per `demoNotice.whyItems` entry, in order.
const ITEM_ICONS: LucideIcon[] = [Store, Lightbulb, Database, EyeOff, Coins, Trash2, Scale];

/**
 * "Didn't ask for this page? Here's why you see it": the disclosure for a
 * business that receives a demo page it never asked for. Who made it, why,
 * where the data comes from, who can see it, that it costs nothing, how to get
 * it deleted, and their GDPR rights (Art. 14 notice; the full text is the
 * Privacy Policy's #demo-pages section). "Delete this page" mails the privacy
 * inbox with the request pre-written.
 *
 * Opened from the visitor pill, the pitch video and DemoNoticeSheet (see
 * demo-notice-store). Same frame as DemoNoticeSheet, but neutral colors: it's
 * information, not a pitch.
 */
export function DemoWhySheet({ username }: { username: string }) {
  const { t } = useLanguage();
  const c = t.demoNotice;
  const { whyOpen } = useDemoNotice();
  const close = demoNotice.closeWhy;

  useEffect(() => {
    if (!whyOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [whyOpen, close]);

  if (!whyOpen) return null;

  const deleteHref = `mailto:${COMPANY.emails.privacy}?subject=${encodeURIComponent(
    c.whyDeleteSubject.replace("{username}", username)
  )}&body=${encodeURIComponent(c.whyDeleteBody.replace("{username}", username))}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-why-title"
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-clip bg-background text-foreground shadow-2xl",
          "rounded-t-[2rem] animate-in slide-in-from-bottom duration-300 ease-out motion-reduce:animate-none",
          "md:mx-4 md:max-h-[85dvh] md:max-w-lg md:rounded-[2rem] md:slide-in-from-bottom-0 md:zoom-in-95 md:fade-in"
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 id="demo-why-title" className="text-2xl font-bold leading-tight tracking-tight text-balance">
            {c.whyTitle}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={c.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.whyIntro}</p>
          <ul className="mt-5 flex flex-col gap-4">
            {c.whyItems.map((item, i) => {
              const Icon = ITEM_ICONS[i] ?? Store;
              return (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-300">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/privacy#demo-pages"
            onClick={close}
            className="mt-5 inline-block text-sm font-medium underline underline-offset-4 hover:text-violet-600"
          >
            {c.whyPrivacy}
          </Link>
        </div>

        <div className="flex flex-col gap-2 border-t px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:flex-row-reverse md:pb-6">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-full bg-zinc-950 text-base font-semibold text-white transition-transform active:scale-[0.98] dark:bg-white dark:text-zinc-950"
          >
            {c.whyGotIt}
          </button>
          <a
            href={deleteHref}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-base font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {c.whyDelete}
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
