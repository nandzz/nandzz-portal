export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicWidgetById } from "@/lib/widgets/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { renderWidgetIcon } from "@/components/widgets/widgetIcon";
import { CalendarBookingFlow } from "@/components/widgets/calendar/CalendarBookingFlow";
import { ShareMenu } from "@/components/spaces/ShareMenu";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/lib/types";

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
function widgetHeading(slug: string, name: string, displayName: string) {
  if (slug === "calendar") return `Book with ${displayName}`;
  return name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; instanceId: string }>;
}): Promise<Metadata> {
  const { username, instanceId } = await params;
  const { profile, widget } = await getData(username, instanceId);
  if (!profile || !widget) return { title: "Widget Not Found | Nandzz" };

  const displayName = profile.display_name || profile.username;
  const heading = widgetHeading(widget.catalog.slug, widget.catalog.name, displayName);
  const description =
    widget.catalog.description || `${heading} directly from ${displayName}'s profile on nandzz.`;
  const url = `https://nandzz.com/${username}/widget/${instanceId}`;

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
  const { profile, widget } = await getData(username, instanceId);

  // Not found unless the profile exists and the widget is live (enabled + entitled).
  if (!profile || !widget) notFound();

  // Sharing (link + QR) is an owner-only affordance — it's how the owner
  // distributes the widget; visitors just book.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  const displayName = profile.display_name || profile.username;
  const heading = widgetHeading(widget.catalog.slug, widget.catalog.name, displayName);
  const config = normalizeCalendarConfig(widget.config);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Top bar — back, widget identity, share (link + QR), owner avatar. */}
      <div className="sticky top-16 z-10 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="relative">
          {/* Back — pinned to the far left on desktop, inline on mobile. */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 md:left-4">
            <BackButton />
          </div>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-2.5 pl-14 md:pl-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              {renderWidgetIcon(widget.catalog.icon, "h-4 w-4 text-emerald-600 dark:text-emerald-400")}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold leading-none">{heading}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{widget.catalog.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isOwner && (
              <ShareMenu url={`/${username}/widget/${instanceId}`} title={heading} size="md" />
            )}
            <Link
              href={`/${username}`}
              className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`View ${displayName}'s profile`}
            >
              <Avatar className="h-7 w-7 border border-border/50">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-violet-100 text-xs text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
          </div>
        </div>
      </div>

      {/* Widget body */}
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        {widget.catalog.slug === "calendar" ? (
          <CalendarBookingFlow
            instanceId={widget.id}
            services={config.services}
            timezone={config.timezone}
            businessName={displayName}
            staff={config.staff}
            showPrices={config.show_prices}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            This widget can&apos;t be displayed yet.
          </p>
        )}
      </div>
    </div>
  );
}
