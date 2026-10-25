"use client";

import { useId, type ReactNode, type Ref } from "react";
import { CalendarCheck, CalendarPlus, Mail, Phone, StickyNote, TriangleAlert, Sparkles } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { whatsappLink } from "@/features/booking/domain/contact";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { TodayBooking, TodayCustomerInsight } from "@/features/booking/dashboardTypes";
import { CustomerAvatar, ViewProfileLink } from "../CustomerIdentity";
import { phaseOf, serviceLines, type TodayFormat } from "./todayFormat";

// The right-hand focus of the Today tab: one appointment in detail (by default
// the one in progress, else the next) and what the business knows about that
// customer — visits, spend, habits, past notes, and whether they've rebooked.

type Props = {
  ref?: Ref<HTMLElement>;
  booking: TodayBooking | null;
  // The appointment is the first one after today (nothing left today).
  isLaterDay: boolean;
  // The owner picked this appointment rather than it being the default focus.
  isPicked: boolean;
  insight: TodayCustomerInsight | null;
  now: number;
  fmt: TodayFormat;
};

export function TodayFocusPanel({ ref, booking, isLaterDay, isPicked, insight, now, fmt }: Props) {
  const { t } = useLanguage();
  const tt = t.bookingToday;
  const headingId = useId();

  if (!booking) {
    return (
      <section ref={ref} className="rounded-2xl border border-dashed border-border p-6 text-center">
        <CalendarCheck className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 font-medium">{tt.emptyPanel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{tt.emptyPanelHint}</p>
      </section>
    );
  }

  const b = booking;
  const phase = phaseOf(b, now);
  const start = Date.parse(b.starts_at);
  const end = Date.parse(b.ends_at);
  const firstName = b.customer_name.split(" ")[0] || b.customer_name;
  const wa = b.customer_phone
    ? whatsappLink(b.customer_phone, t.booking.whatsappSimpleGreeting.replace("{name}", firstName))
    : null;

  const heading =
    phase === "live"
      ? tt.panelLive
      : phase === "done"
        ? tt.panelDone
        : phase === "cancelled"
          ? t.booking.tagCancelled
          : isPicked
            ? tt.panelSelected
            : tt.panelNext;

  const visitNumber = insight ? insight.pastVisits + 1 : null;

  return (
    <section
      ref={ref}
      aria-labelledby={headingId}
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-background"
    >
      {/* Appointment */}
      <div className={cn("p-5", phase === "live" && "bg-emerald-500/[0.07]")}>
        <p id={headingId} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {phase === "live" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />}
          {heading}
        </p>

        <div className="mt-2 flex items-baseline gap-3">
          <p className={cn("text-3xl font-bold tracking-tight tabular-nums", phase === "cancelled" && "line-through opacity-60")}>
            {isLaterDay ? fmt.upcomingWhen(b.starts_at, now) : fmt.time(b.starts_at)}
          </p>
          {phase === "upcoming" && !isLaterDay && (
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{fmt.countdown(start, now)}</span>
          )}
          {phase !== "upcoming" && !isLaterDay && (
            <span className="text-sm text-muted-foreground tabular-nums">– {fmt.time(b.ends_at)}</span>
          )}
        </div>

        {phase === "live" && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-emerald-500/15">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, ((now - start) / Math.max(1, end - start)) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {tt.endsAt.replace("{time}", fmt.time(b.ends_at))}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <CustomerAvatar name={b.customer_name} profile={b.customer_profile} className="h-11 w-11 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{b.customer_name}</p>
            {visitNumber !== null && (
              <p className="text-xs text-muted-foreground">
                {visitNumber === 1 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-violet-700 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" /> {tt.newCustomer}
                  </span>
                ) : (
                  tt.visitNumber.replace("{n}", String(visitNumber))
                )}
              </p>
            )}
          </div>
          {b.customer_profile && <ViewProfileLink profile={b.customer_profile} />}
        </div>

        <ul className="mt-4 space-y-1.5">
          {serviceLines(b).map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{s.name}</span>
              {s.staff && <span className="shrink-0 text-xs text-muted-foreground">{s.staff}</span>}
            </li>
          ))}
        </ul>
        {b.price_cents != null && b.price_cents > 0 && (
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">{fmt.money(b.price_cents)}</p>
        )}

        {b.notes && b.notes.trim() && (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <StickyNote className="h-3.5 w-3.5" /> {tt.bookingNote}
            </p>
            <p className="whitespace-pre-line break-words">{b.notes.trim()}</p>
          </div>
        )}

        {(b.customer_phone || b.customer_email) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {b.customer_phone && (
              <ContactButton href={`tel:${b.customer_phone}`} icon={<Phone className="h-4 w-4" />} label={tt.call} />
            )}
            {wa && (
              <ContactButton href={wa} external icon={<WhatsAppIcon className="h-4 w-4" />} label={t.booking.whatsappTitle} />
            )}
            {b.customer_email && (
              <ContactButton href={`mailto:${b.customer_email}`} icon={<Mail className="h-4 w-4" />} label={tt.email} />
            )}
          </div>
        )}
      </div>

      {/* Customer history & preferences */}
      {insight && <CustomerInsight insight={insight} name={firstName} now={now} fmt={fmt} />}
    </section>
  );
}

function CustomerInsight({
  insight: c,
  name,
  now,
  fmt,
}: {
  insight: TodayCustomerInsight;
  name: string;
  now: number;
  fmt: TodayFormat;
}) {
  const { t } = useLanguage();
  const tt = t.bookingToday;

  const daypart =
    c.usualDaypart === "morning"
      ? tt.morning
      : c.usualDaypart === "afternoon"
        ? tt.afternoon
        : c.usualDaypart === "evening"
          ? tt.evening
          : null;
  const usual = [c.usualWeekday !== null ? fmt.weekday(c.usualWeekday) : null, daypart].filter(Boolean).join(", ");
  const frequency =
    c.avgGapDays === null || c.avgGapDays <= 0
      ? null
      : c.avgGapDays >= 14
        ? tt.everyWeeks.replace("{n}", String(Math.round(c.avgGapDays / 7)))
        : tt.everyDays.replace("{n}", String(c.avgGapDays));

  const prefs: { label: string; value: ReactNode }[] = [];
  if (c.topServices.length > 0)
    prefs.push({
      label: tt.prefServices,
      value: (
        <span className="flex flex-wrap justify-end gap-1">
          {c.topServices.map((s) => (
            <span key={s.name} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {s.name}
              {s.count > 1 && <span className="ml-1 tabular-nums text-muted-foreground">×{s.count}</span>}
            </span>
          ))}
        </span>
      ),
    });
  if (c.topStaff)
    prefs.push({
      label: tt.prefStaff,
      value: tt.prefStaffValue
        .replace("{name}", c.topStaff.name)
        .replace("{count}", String(c.topStaff.count))
        .replace("{of}", String(c.topStaff.of)),
    });
  if (usual) prefs.push({ label: tt.prefWhen, value: <span className="first-letter:uppercase">{usual}</span> });
  if (frequency) prefs.push({ label: tt.prefFrequency, value: frequency });
  if (c.firstVisit) prefs.push({ label: tt.prefSince, value: fmt.monthYear(c.firstVisit) });

  return (
    <div className="space-y-5 border-t border-border p-5">
      <h3 className="text-sm font-semibold">{tt.historyTitle}</h3>

      {c.pastVisits === 0 ? (
        <p className="rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          {tt.firstVisitBody.replace("{name}", name)}
        </p>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
          <Stat label={tt.statVisits} value={String(c.pastVisits)} />
          <Stat label={tt.statSpent} value={fmt.money(c.spentCents)} />
          <Stat label={tt.statLastVisit} value={c.lastVisit ? fmt.ago(c.lastVisit, now) : "—"} />
        </div>
      )}

      {prefs.length > 0 && (
        <dl className="space-y-2.5">
          {prefs.map((p) => (
            <div key={p.label} className="flex items-start justify-between gap-4 text-sm">
              <dt className="shrink-0 text-muted-foreground">{p.label}</dt>
              <dd className="min-w-0 text-right font-medium">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {c.notes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{tt.pastNotes}</p>
          <ul className="space-y-2">
            {c.notes.map((n) => (
              <li key={n.date} className="border-l-2 border-amber-300 pl-3 text-sm dark:border-amber-700">
                <p className="whitespace-pre-line break-words">{n.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground first-letter:uppercase">{fmt.shortDay(n.date)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{tt.recentVisits}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {c.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{r.services}</p>
                  <p className="text-xs text-muted-foreground first-letter:uppercase">{fmt.shortDay(r.starts_at)}</p>
                </div>
                {r.price_cents != null && r.price_cents > 0 && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmt.money(r.price_cents)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {c.nextVisit ? (
          <Signal tone="good" icon={<CalendarCheck className="h-4 w-4" />}>
            {tt.nextBooked.replace("{when}", fmt.upcomingWhen(c.nextVisit, now))}
          </Signal>
        ) : (
          c.pastVisits > 0 && (
            <Signal tone="hint" icon={<CalendarPlus className="h-4 w-4" />}>
              {tt.noNextBooked}
            </Signal>
          )
        )}
        {c.cancelled > 0 && (
          <Signal tone="warn" icon={<TriangleAlert className="h-4 w-4" />}>
            {(c.cancelled === 1 ? tt.cancelledOnce : tt.cancelledTimes).replace("{count}", String(c.cancelled))}
          </Signal>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums first-letter:uppercase">{value}</p>
    </div>
  );
}

function Signal({ tone, icon, children }: { tone: "good" | "hint" | "warn"; icon: ReactNode; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-sm",
        tone === "good" && "text-emerald-700 dark:text-emerald-300",
        tone === "hint" && "text-amber-700 dark:text-amber-300",
        tone === "warn" && "text-rose-700 dark:text-rose-300",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function ContactButton({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </a>
  );
}
