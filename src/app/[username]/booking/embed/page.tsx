export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicProfile, getIsDemoProfile } from "@/features/profile/server";
import { getPublicCalendar } from "@/features/booking/server";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import { currencySymbol } from "@/features/booking/domain/messages";
import { isWhatsAppReminderLive } from "@/features/booking/domain/whatsapp-reminder";
// Direct path, not the barrel: keeps the rest of the booking feature out of
// this page's client bundle (it loads on third-party sites).
import { EmbedBooking } from "@/features/booking/components/calendar/EmbedBooking";
import { getUserEntitlements } from "@/lib/plan";
import { getServerTranslations } from "@/lib/i18n/server";
import type { Profile } from "@/lib/types";

// Booking flow for a business's own website, loaded in an iframe by
// `public/embed.js` (or a plain <iframe>). Framable from any origin — see the
// EMBED_ROUTE headers in next.config.ts. Query params:
//   lang=it|en|…       language (handled in proxy.ts; cookies don't work here)
//   theme=light|dark   lock the theme (default: light)
//   mode=inline|popup  inline grows with the flow; popup pins the actions
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function BookingEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = (await fetchPublicProfile(username)) as Profile | null;
  if (!profile) notFound();

  // Same gate as the public booking page: the widget must be live (enabled +
  // entitled by the owner's plan).
  const [widget, t, whatsappLive, isDemo, entitlements] = await Promise.all([
    getPublicCalendar(profile.id),
    getServerTranslations(),
    isWhatsAppReminderLive(),
    getIsDemoProfile(username),
    getUserEntitlements(profile.id),
  ]);
  if (!widget || widget.catalog.slug !== "calendar") notFound();

  const config = normalizeCalendarConfig(widget.config);
  const displayName = profile.display_name || profile.username;
  const theme = query.theme === "dark" ? "dark" : "light";
  const mode = query.mode === "popup" ? "popup" : "inline";

  return (
    // Theme-locked subtree: the host site decides the look, not the visitor's
    // nandzz.com preference (see the `.light` / `.dark` vars in globals.css).
    <div className={`${theme} bg-transparent text-foreground`} style={{ colorScheme: theme }}>
      <EmbedBooking
        mode={mode}
        instanceId={widget.id}
        locations={config.locations}
        services={config.services}
        categories={config.categories}
        timezone={config.timezone}
        businessName={displayName}
        staff={config.staff}
        showPrices={config.show_prices}
        currencySymbol={currencySymbol(config.currency)}
        collectAddress={config.collect_address}
        addressRequired={config.address_required}
        offerWhatsAppReminder={whatsappLive && config.whatsapp_reminder}
        isDemo={isDemo}
      >
        {!entitlements.hideBranding && (
          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            <a
              href="https://nandzz.com/?ref=booking-embed"
              target="_blank"
              rel="noopener"
              className="hover:text-foreground hover:underline"
            >
              {t.booking.embedPoweredBy}
            </a>
          </p>
        )}
      </EmbedBooking>
    </div>
  );
}
