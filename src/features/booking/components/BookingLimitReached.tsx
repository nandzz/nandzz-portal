import Link from "next/link";
import { CalendarOff, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/features/booking/domain/contact";
import type { Translations } from "@/lib/i18n/translations";

// Shown on the public booking link (page + embed) when the owner's plan hit its
// monthly booking cap: online booking is paused, visitors are invited to reach
// the business on WhatsApp instead. Server-renderable (no client state).
export function BookingLimitReached({
  t,
  businessName,
  whatsapp,
  profileHref,
}: {
  t: Translations;
  businessName: string;
  whatsapp: string | null | undefined;
  profileHref?: string;
}) {
  const waHref = whatsapp
    ? whatsappLink(whatsapp, t.booking.limitReachedWhatsappMessage.replace("{name}", businessName))
    : null;
  return (
    <div className="flex flex-col items-center px-2 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <CalendarOff className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{t.booking.limitReachedTitle}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t.booking.limitReachedBody.replace("{name}", businessName)}
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {t.booking.limitReachedWhatsapp}
          </a>
        )}
        {profileHref && (
          <Link
            href={profileHref}
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.booking.limitReachedProfile}
          </Link>
        )}
      </div>
    </div>
  );
}
