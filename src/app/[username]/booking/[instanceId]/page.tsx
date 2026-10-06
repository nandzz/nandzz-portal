export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicWidgetById } from "@/features/booking/server";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import { currencySymbol } from "@/features/booking/domain/messages";
import { isWhatsAppReminderLive } from "@/features/booking/domain/whatsapp-reminder";
import { renderWidgetIcon, CalendarBookingFlow } from "@/features/booking";
import { ShareMenu } from "@/features/spaces";
import { BackButton } from "@/components/ui/BackButton";
import type { Profile } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";
import type { Translations } from "@/lib/i18n/translations";

// react.cache dedupes the fetch between generateMetadata and the page render.
const getData = cache(async (username: string, instanceId: string) => {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  if (!profile) return { profile: null as Profile | null, widget: null };
  const widget = await getPublicWidgetById((profile as Profile).id, instanceId);
  return { profile: profile as Profile, widget };
});

// Friendly heading per widget type; falls back to the catalog name.
function widgetHeading(t: Translations, slug: string, name: string, displayName: string) {
  if (slug === "calendar") return t.booking.bookWithName.replace("{name}", displayName);
  return name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; instanceId: string }>;
}): Promise<Metadata> {
  const { username, instanceId } = await params;
  const [{ profile, widget }, t] = await Promise.all([
    getData(username, instanceId),
    getServerTranslations(),
  ]);
  if (!profile || !widget) return { title: t.booking.widgetNotFound };

  const displayName = profile.display_name || profile.username;
  const heading = widgetHeading(t, widget.catalog.slug, widget.catalog.name, displayName);
  const description =
    widget.catalog.description ||
    t.booking.widgetDescriptionFallback.replace("{heading}", heading).replace("{name}", displayName);
  const url = `https://nandzz.com/${username}/booking/${instanceId}`;

  return {
    title: heading,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: heading,
      description,
      type: "website",
      url,
      siteName: "Nandzz",
      ...(profile.avatar_url && { images: [{ url: profile.avatar_url, alt: displayName }] }),
    },
    twitter: {
      card: "summary",
      title: `${heading} | Nandzz`,
      description,
      ...(profile.avatar_url && { images: [profile.avatar_url] }),
    },
  };
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ username: string; instanceId: string }>;
}) {
  const { username, instanceId } = await params;
  const [{ profile, widget }, t, whatsappLive] = await Promise.all([
    getData(username, instanceId),
    getServerTranslations(),
    isWhatsAppReminderLive(),
  ]);

  // Not found unless the profile exists and the widget is live (enabled + entitled).
  if (!profile || !widget) notFound();

  const displayName = profile.display_name || profile.username;
  const heading = widgetHeading(t, widget.catalog.slug, widget.catalog.name, displayName);
  const config = normalizeCalendarConfig(widget.config);

  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient brand glow behind the hero — soft, slow, purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden">
        <div className="animate-hero-gradient absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-600/20" />
        <div className="animate-hero-gradient-2 absolute left-1/2 top-8 h-60 w-60 -translate-x-1/4 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-700/20" />
      </div>

      {/* Floating controls — back (left) and share (right), no app chrome. */}
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-5">
        <BackButton />
        {/* Share (link + QR) is public — any visitor can pass the widget along. */}
        <ShareMenu url={`/${username}/booking/${instanceId}`} title={heading} size="md" />
      </div>

      {/* Branded hero — business avatar + name lead; the widget it hosts follows
          as a subtle pill. */}
      <header className="mx-auto flex max-w-lg flex-col items-center px-4 pt-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
        <Link
          href={`/${username}`}
          aria-label={`View ${displayName}'s profile`}
          className="group relative inline-block"
        >
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-400/50 to-violet-400/50 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
          />
          <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-2xl font-semibold text-violet-700 shadow-lg ring-2 ring-background transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none dark:bg-violet-900 dark:text-violet-300">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{displayName}</h1>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          {renderWidgetIcon(widget.catalog.icon, "h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400")}
          {widget.catalog.name}
        </span>
      </header>

      {/* Widget body — the booking flow, lifted onto a card. */}
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both motion-reduce:animate-none">
          {widget.catalog.slug === "calendar" ? (
            <CalendarBookingFlow
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
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t.booking.widgetUnavailable}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
