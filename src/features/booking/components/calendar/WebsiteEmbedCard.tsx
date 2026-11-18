"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, CalendarDays, MousePointerClick, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  username: string;
  // Booking is live (enabled + entitled). The embed 404s otherwise, so the
  // snippets are only offered once it is.
  live: boolean;
}

type Kind = "inline" | "popup";
type Look = "light" | "dark";

const PROD_ORIGIN = "https://nandzz.com";
const noopSubscribe = () => () => {};

declare global {
  interface Window {
    NandzzBooking?: { scan: () => void };
  }
}

// Load the real loader once, so the preview is exactly what a business's site
// runs. Later calls rescan for freshly rendered preview elements.
function ensureEmbedScript() {
  if (window.NandzzBooking) {
    window.NandzzBooking.scan();
    return;
  }
  if (document.querySelector("script[data-nandzz-embed-loader]")) return; // loading: it scans on load
  const s = document.createElement("script");
  s.src = "/embed.js";
  s.async = true;
  s.dataset.nandzzEmbedLoader = "1";
  document.body.appendChild(s);
}

// "Website" section: pick how booking appears (calendar or button) and its
// look, copy the snippet, and try it live. The snippet loads
// `public/embed.js`, which frames `/<username>/booking/embed`.
export function WebsiteEmbedCard({ username, live }: Props) {
  const { t, locale } = useLanguage();
  const [kind, setKind] = useState<Kind>("inline");
  const [look, setLook] = useState<Look>("light");
  // The snippet points at whichever host serves this dashboard (nandzz.com in
  // prod, localhost when testing). Server render uses prod.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => PROD_ORIGIN);

  if (!live) {
    return (
      <div className="space-y-4">
        <Intro title={t.booking.embedTitle} desc={t.booking.embedDesc} />
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          {t.booking.embedInactive}
        </p>
      </div>
    );
  }

  const attrs = `data-lang="${locale}"${look === "dark" ? ` data-theme="dark"` : ""}`;
  const code =
    (kind === "inline"
      ? `<div data-nandzz-booking="${username}" ${attrs}></div>`
      : `<button data-nandzz-booking-popup="${username}" ${attrs}>${t.booking.bookNow}</button>`) +
    `\n<script src="${origin}/embed.js" async></script>`;

  const kinds = [
    { id: "inline" as const, icon: CalendarDays, title: t.booking.embedInlineTitle, desc: t.booking.embedInlineDesc },
    { id: "popup" as const, icon: MousePointerClick, title: t.booking.embedPopupTitle, desc: t.booking.embedPopupDesc },
  ];

  return (
    <div className="space-y-6">
      <Intro title={t.booking.embedTitle} desc={t.booking.embedDesc} />

      {/* Type */}
      <Field label={t.booking.embedTypeLabel}>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.booking.embedTypeLabel}>
          {kinds.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border bg-background p-4 text-left transition",
                  active
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : "border-border hover:border-foreground/20"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                  )}
                >
                  <k.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{k.title}</span>
                  <span className="block text-sm text-muted-foreground">{k.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Look */}
      <Field label={t.booking.embedLookLabel}>
        <div className="inline-flex rounded-lg bg-muted p-[3px]" role="radiogroup" aria-label={t.booking.embedLookLabel}>
          {([
            { id: "light" as const, icon: Sun, label: t.booking.embedLookLight },
            { id: "dark" as const, icon: Moon, label: t.booking.embedLookDark },
          ]).map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={look === l.id}
              onClick={() => setLook(l.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                look === l.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Code */}
      <Field label={t.booking.embedCodeLabel} hint={t.booking.embedHowTo}>
        <Snippet code={code} copyLabel={t.booking.embedCopy} copiedLabel={t.booking.embedCopied} />
      </Field>

      {/* Preview */}
      <Field label={t.booking.embedPreviewLabel} hint={t.booking.embedPreviewHint}>
        <LivePreview kind={kind} look={look} username={username} locale={locale} buttonLabel={t.booking.bookNow} />
      </Field>
    </div>
  );
}

function Intro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-border pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A mock "your website" surface hosting the real embed. Re-keyed on every
// option change so embed.js mounts a fresh frame with the new settings.
function LivePreview({
  kind,
  look,
  username,
  locale,
  buttonLabel,
}: {
  kind: Kind;
  look: Look;
  username: string;
  locale: string;
  buttonLabel: string;
}) {
  useEffect(() => {
    ensureEmbedScript();
  }, [kind, look]);

  const dark = look === "dark";
  return (
    <div
      key={`${kind}-${look}`}
      className="overflow-hidden rounded-2xl border border-border"
      style={{ background: dark ? "#141418" : "#f6f6f8" }}
    >
      {/* Browser-ish top bar so it reads as "your site", not the dashboard. */}
      <div
        className="flex items-center gap-1.5 border-b px-3 py-2"
        style={{ borderColor: dark ? "#2a2a30" : "#e6e6ea" }}
        aria-hidden
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: dark ? "#3a3a42" : "#d4d4da" }} />
        ))}
      </div>
      <div className="mx-auto max-w-lg p-4 sm:p-6">
        {kind === "inline" ? (
          <div data-nandzz-booking={username} data-lang={locale} data-theme={look} />
        ) : (
          <div className="flex justify-center py-10">
            <button
              type="button"
              data-nandzz-booking-popup={username}
              data-lang={locale}
              data-theme={look}
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              {buttonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Snippet({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code stays selectable in the box.
    }
  }

  return (
    <div className="relative">
      {/* Wraps instead of scrolling (no component scrollbars). */}
      <pre className="whitespace-pre-wrap break-all rounded-xl bg-muted py-3 pl-3 pr-28 font-mono text-xs leading-relaxed text-foreground select-all">
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-muted"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
