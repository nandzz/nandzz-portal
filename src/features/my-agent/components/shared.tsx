"use client";

import { Dialog } from "@/components/ui/dialog";
import { Sheet, useSheetLayout } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// Small building blocks shared by the My Agent tabs.

/** Fills `{name}` placeholders in a dictionary string. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** My Agent strings + the viewer's locale. */
export function useMyAgentT() {
  const { t, locale } = useLanguage();
  return { t: t.myAgent, locale };
}

/** "4 min ago" against the server-rendered anchor, so server and client agree. */
export function relativeTime(iso: string, now: number, locale: string): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 60_000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (abs < 1) return rtf.format(0, "second");
  if (abs < 60) return rtf.format(diff, "minute");
  if (abs < 1440) return rtf.format(Math.round(diff / 60), "hour");
  return rtf.format(Math.round(diff / 1440), "day");
}

/** Bottom sheet below `sm`, centered dialog above — the owner-panel convention. */
export function ResponsivePanel({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Sticky action bar (pinned to the sheet's bottom on phones). */
  footer?: React.ReactNode;
}) {
  const sheet = useSheetLayout();
  if (sheet) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()} aria-label={title} className="max-h-[85dvh]">
        <div className="px-5 pb-2 pt-1">
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-border/60 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidthClass="max-w-lg">
      <div className="max-h-[60vh] overflow-y-auto">{children}</div>
      {footer && <div className="mt-5 border-t border-border/60 pt-4">{footer}</div>}
    </Dialog>
  );
}

/** Pill-style segmented control. Scales to a handful of options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97]",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span
                className={cn(
                  "min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4 tabular-nums",
                  active ? "bg-violet-600 text-white" : "bg-foreground/10",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Section card used by Settings / Knowledge / Channels. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Thin progress meter. `warnAt` (0–1) turns it amber past that share. */
export function Meter({ value, max, warnAt = 0.8 }: { value: number; max: number; warnAt?: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn("h-full rounded-full", ratio >= 1 ? "bg-destructive" : ratio >= warnAt ? "bg-amber-500" : "bg-violet-600")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden className="mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
