"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarCheck, EyeOff, Loader2, Power, Sparkles, X } from "lucide-react";
import { updateWidgetInstance } from "@/features/booking/actions/update-widget-instance";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  instanceId: string;
  hasAccess: boolean;
  enabled: boolean;
  username?: string;
}

// Owners often don't realise their public "Book" button is hidden. This banner
// sits atop the booking dashboard (every tab) whenever the button isn't live and
// explains why: either the widget is toggled off (one-click fix inline) or the
// plan doesn't include widgets (upgrade CTA). After an inline activation it
// flips to a "You're live" confirmation the owner can dismiss. It's always
// mounted so that local state survives the router.refresh() that follows.
export function BookingActivationBanner({ instanceId, hasAccess, enabled, username }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [justActivated, setJustActivated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const live = hasAccess && (enabled || justActivated);
  if (dismissed || (live && !justActivated)) return null;

  const variant: "upgrade" | "off" | "live" = !hasAccess ? "upgrade" : live ? "live" : "off";

  function activate() {
    setError(false);
    startTransition(async () => {
      try {
        const res = await updateWidgetInstance({ instanceId, enabled: true });
        if (!res.ok) {
          setError(true);
          return;
        }
        setJustActivated(true);
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }

  const title =
    variant === "live" ? t.booking.activationLiveTitle : variant === "off" ? t.booking.activationOffTitle : t.booking.activationUpgradeTitle;
  const body =
    variant === "live" ? t.booking.activationLiveBody : variant === "off" ? t.booking.activationOffBody : t.booking.activationUpgradeBody;

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "relative mb-8 overflow-hidden rounded-3xl border p-5 sm:p-6",
        "animate-in fade-in slide-in-from-top-2 duration-500 motion-reduce:animate-none",
        "transition-colors duration-500",
        variant === "live"
          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25"
          : "border-border bg-card"
      )}
    >
      {/* Soft brand glow — decorative, stays behind content. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-opacity duration-700",
          variant === "upgrade" ? "bg-amber-300/25 dark:bg-amber-500/10" : "bg-emerald-300/30 dark:bg-emerald-500/15"
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-foreground)_1px,transparent_0)] bg-[size:18px_18px] opacity-[0.07] [mask-image:linear-gradient(to_left,black,transparent_60%)]"
      />

      {variant === "live" && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.booking.activationDismiss}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 transition-colors duration-500",
              variant === "live" && "bg-emerald-600 text-white ring-emerald-600",
              variant === "off" && "bg-background text-emerald-600 ring-border dark:text-emerald-400",
              variant === "upgrade" && "bg-background text-amber-600 ring-border dark:text-amber-400"
            )}
          >
            {variant === "live" ? (
              <CalendarCheck className="h-5 w-5" />
            ) : variant === "off" ? (
              <Power className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
              <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {variant === "off" && (
                <button
                  type="button"
                  onClick={activate}
                  disabled={pending}
                  className="group inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-70"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  {pending ? t.booking.activationTurningOn : t.booking.activationTurnOn}
                </button>
              )}
              {variant === "upgrade" && (
                <Link
                  href="/dashboard/credits"
                  className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-sm transition hover:opacity-90 active:scale-[0.97]"
                >
                  {t.plan.upgradeToStarter}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              )}
              {variant === "live" && username && (
                <Link
                  href={`/${username}`}
                  target="_blank"
                  className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.97]"
                >
                  {t.booking.activationViewProfile}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              )}
              {error && <span className="text-sm text-red-600">{t.booking.errorCouldNotSave}</span>}
            </div>
          </div>
        </div>

        <ProfilePreview live={variant === "live"} cta={t.booking.activationPreviewCta} statusLabel={variant === "live" ? t.booking.activationStatusLive : t.booking.activationStatusHidden} />
      </div>
    </section>
  );
}

// Miniature profile card showing exactly what visitors see: the "Book" button
// as a dashed ghost while hidden, morphing into the solid CTA once live.
function ProfilePreview({ live, cta, statusLabel }: { live: boolean; cta: string; statusLabel: string }) {
  return (
    <div aria-hidden className="relative hidden w-56 shrink-0 sm:block">
      <div className="rotate-[1.5deg] rounded-2xl border border-border bg-background/90 p-4 shadow-lg shadow-black/5 backdrop-blur transition-transform duration-500 hover:rotate-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-20 rounded-full bg-muted-foreground/25" />
            <div className="h-2 w-14 rounded-full bg-muted-foreground/15" />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-muted-foreground/10" />
          <div className="h-1.5 w-4/5 rounded-full bg-muted-foreground/10" />
        </div>
        <div
          className={cn(
            "mt-4 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all duration-500",
            live
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "border border-dashed border-muted-foreground/30 text-muted-foreground/60"
          )}
        >
          {live ? <CalendarCheck className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {cta}
        </div>
      </div>
      <span
        className={cn(
          "absolute -left-2 -top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm ring-1 transition-colors duration-500",
          live
            ? "bg-emerald-600 text-white ring-emerald-600"
            : "bg-background text-muted-foreground ring-border"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-white motion-reduce:animate-none" : "bg-muted-foreground/50")} />
        {statusLabel}
      </span>
    </div>
  );
}
