"use client";

import { useMemo } from "react";
import { Ban, CalendarClock, ChevronRight, Clock, Loader2, Mail, MapPin, Phone, StickyNote, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Dialog } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BookingRowData } from "@/features/booking/components/calendar/BookingRow";
import { CustomerAvatar, ViewProfileLink } from "@/features/booking/components/calendar/CustomerIdentity";

// Detail modal for one booking (opened by clicking a row in the Bookings tab or
// the calendar agenda): the booking itself on top, the client below — with
// their profile picture + a link to their Nandzz profile when they booked while
// logged in. Actions are the row's own handlers, so behaviour stays in one place.

type Props = {
  open: boolean;
  onClose: () => void;
  b: BookingRowData;
  tag: { label: string; className: string; live?: boolean } | null;
  when: string;
  timezone: string;
  money: (cents: number) => string;
  wa: string | null;
  busy: boolean;
  // Opens the customer card (history + stats); absent when the row has no key.
  onOpenCustomer?: () => void;
  onReschedule?: () => void;
  onAssign?: () => void;
  onCancel?: () => void;
};

export function BookingDetailsDialog({
  open,
  onClose,
  b,
  tag,
  when,
  timezone,
  money,
  wa,
  busy,
  onOpenCustomer,
  onReschedule,
  onAssign,
  onCancel,
}: Props) {
  const { t, locale } = useLanguage();

  const endTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(
        new Date(b.ends_at)
      ),
    [locale, timezone, b.ends_at]
  );

  const services =
    b.services && b.services.length > 0
      ? b.services.map((s) => ({ key: s.service_id, name: s.name, staff: s.staff_name ?? null }))
      : [{ key: b.service_id, name: b.service_name, staff: b.staff_name }];

  const profile = b.customer_profile ?? null;
  const email = b.customer_email?.trim() || null;
  const phone = b.customer_phone?.trim() || null;
  const hasActions = Boolean(onReschedule || onAssign || onCancel);

  return (
    <Dialog open={open} onClose={onClose} maxWidthClass="max-w-lg">
      {/* ── Booking ── */}
      <div className="-mt-2">
        {tag && (
          <span
            className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tag.className}`}
          >
            {tag.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
            {tag.label}
          </span>
        )}
        <h2 className="text-lg font-semibold">{services.map((s) => s.name).join(" + ")}</h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <Clock className="h-3.5 w-3.5" />
          <span className="first-letter:uppercase">
            {when} – {endTime}
          </span>
        </p>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border">
        {services.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="truncate">{s.name}</span>
            {s.staff && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {s.staff}
              </span>
            )}
          </div>
        ))}
        {b.price_cents != null && b.price_cents > 0 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">{t.booking.bookingDetailsPrice}</span>
            <span className="font-semibold tabular-nums">{money(b.price_cents)}</span>
          </div>
        )}
      </div>

      {b.notes?.trim() && (
        <div className="mt-3 flex gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap break-words">{b.notes}</p>
        </div>
      )}

      {hasActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onReschedule && (
            <ActionButton onClick={onReschedule} disabled={busy} icon={<CalendarClock className="h-4 w-4" />}>
              {t.booking.rescheduleTitle}
            </ActionButton>
          )}
          {onAssign && (
            <ActionButton onClick={onAssign} disabled={busy} icon={<Users className="h-4 w-4" />}>
              {t.booking.assignStaff}
            </ActionButton>
          )}
          {onCancel && (
            <ActionButton
              onClick={onCancel}
              disabled={busy}
              danger
              icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            >
              {t.booking.cancelTitle}
            </ActionButton>
          )}
        </div>
      )}

      {/* ── Client ── */}
      <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.booking.bookingDetailsClient}
      </h3>
      <div className="mt-2 rounded-xl border border-border p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenCustomer}
            disabled={!onOpenCustomer}
            className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left transition-colors enabled:hover:bg-muted/60"
          >
            <CustomerAvatar name={b.customer_name} profile={profile} className="h-12 w-12 text-base" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{b.customer_name}</p>
              {profile && <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>}
            </div>
          </button>
          {profile && <ViewProfileLink profile={profile} />}
        </div>
        {onOpenCustomer && (
          <button
            type="button"
            onClick={onOpenCustomer}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t.bookingToday.customerCard}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {(email || phone || b.customer_address) && (
          <div className="mt-3 space-y-1 border-t border-border pt-2">
            {email && <ContactLine icon={<Mail className="h-4 w-4" />} href={`mailto:${email}`} label={email} />}
            {phone && (
              <ContactLine
                icon={<Phone className="h-4 w-4" />}
                href={`tel:${phone}`}
                label={phone}
                trailing={
                  wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
                      aria-label={t.booking.whatsappAria.replace("{name}", b.customer_name)}
                      title={t.booking.whatsappTitle}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )
                }
              />
            )}
            {b.customer_address && <ContactLine icon={<MapPin className="h-4 w-4" />} label={b.customer_address} />}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ActionButton({
  onClick,
  disabled,
  danger,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          : "border-border hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ContactLine({
  icon,
  label,
  href,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="break-words">{label}</span>
    </>
  );
  return (
    <div className="flex items-center gap-2">
      {href ? (
        <a href={href} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted">
          {body}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2.5 px-2 py-1.5 text-sm">{body}</div>
      )}
      {trailing}
    </div>
  );
}
